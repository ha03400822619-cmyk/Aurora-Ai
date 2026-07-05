'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

/* PDF.js 5 rasterization expects browser globals — polyfill before any pdf engine runs. */
function ensureCanvasPolyfills() {
  try {
    const napi = require('@napi-rs/canvas');
    if (!globalThis.DOMMatrix && napi.DOMMatrix) globalThis.DOMMatrix = napi.DOMMatrix;
    if (!globalThis.Path2D && napi.Path2D) globalThis.Path2D = napi.Path2D;
    if (!globalThis.ImageData && napi.ImageData) globalThis.ImageData = napi.ImageData;
  } catch (_) {
    try {
      const nodeCanvas = require('canvas');
      if (!globalThis.DOMMatrix && nodeCanvas.DOMMatrix) globalThis.DOMMatrix = nodeCanvas.DOMMatrix;
      if (!globalThis.Path2D && nodeCanvas.Path2D) globalThis.Path2D = nodeCanvas.Path2D;
      if (!globalThis.ImageData && nodeCanvas.ImageData) globalThis.ImageData = nodeCanvas.ImageData;
    } catch (_) {
      /* ignore */
    }
  }
}

ensureCanvasPolyfills();

const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const WordExtractor = require('word-extractor');
const { createWorker, PSM } = require('tesseract.js');

const pdfPackageRoot = path.dirname(require.resolve('pdfjs-dist/package.json'));

/** @napi-rs/canvas exposes `image/png`; node-canvas used `png` — normalize. */
function canvasToPngBuffer(canvas) {
  if (!canvas) throw new Error('Missing canvas for PNG export.');
  if (typeof canvas.encodeSync === 'function') return canvas.encodeSync('png');
  if (typeof canvas.toBuffer === 'function') return canvas.toBuffer('image/png');
  throw new Error('Canvas PNG export unsupported — check @napi-rs/canvas.');
}

/** Safer than pdf-parse default pagerender — avoids silent empty pages when transform metadata is odd. */
function joinTextItemsPageRender(pageData) {
  return pageData
    .getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false })
    .then((textContent) =>
      (textContent.items || [])
        .map((item) => (typeof item.str === 'string' ? item.str : ''))
        .filter(Boolean)
        .join('\n'),
    );
}

async function extractPdfAsText(buffer) {
  const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const configs = [
    { version: 'v2.0.550', pagerender: joinTextItemsPageRender },
    { version: 'v2.0.550' },
    { version: 'v1.10.100', pagerender: joinTextItemsPageRender },
    { version: 'v1.10.100' },
  ];
  let lastErr;
  for (const opts of configs) {
    try {
      const parsed = await pdfParse(data, opts);
      const text = String(parsed?.text ?? '')
        .replace(/\u0000/g, ' ')
        .trim();
      if (text.length > 0) return text;
    } catch (e) {
      lastErr = e;
    }
  }
  if (lastErr) throw lastErr;
  return '';
}

let pdfJsLoadPromise;
async function loadPdfJs() {
  ensureCanvasPolyfills();
  if (!pdfJsLoadPromise) {
    pdfJsLoadPromise = (async () => {
      const pdfModuleUrl = pathToFileURL(path.join(pdfPackageRoot, 'legacy/build/pdf.mjs')).href;
      const pdfjsLib = await import(pdfModuleUrl);
      pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(
        path.join(pdfPackageRoot, 'legacy/build/pdf.worker.mjs'),
      ).href;
      return pdfjsLib;
    })();
  }
  return pdfJsLoadPromise;
}

function ocrMaxPages() {
  const n = parseInt(process.env.OCR_MAX_PDF_PAGES || '15', 10);
  if (!Number.isFinite(n)) return 15;
  return Math.min(40, Math.max(1, n));
}

function normalizeDocText(raw) {
  return String(raw || '')
    .replace(/\u0000/g, ' ')
    .replace(/\r\n/g, '\n')
    .trim();
}

/**
 * `.docx` via Mammoth first (covers most classroom docs). `.doc` / fallback via word-extractor.
 * Disk path avoids odd buffer edge cases with Multer saves.
 */
async function extractWordFile(ext, filePath) {
  if (ext === '.docx') {
    try {
      const buf = fs.readFileSync(filePath);
      const { value } = await mammoth.extractRawText({ buffer: buf });
      const t = normalizeDocText(value);
      if (t.length > 0) return t;
    } catch (_) {
      /* Mammoth fallback — extractor may still read OLE-style quirks */
    }
  }

  const extractor = new WordExtractor();
  const doc = await extractor.extract(filePath);
  const chunks = [
    doc.getBody(),
    doc.getFootnotes(),
    doc.getEndnotes(),
    doc.getHeaders({ includeFooters: true }),
    doc.getTextboxes(),
  ]
    .map((s) => String(s || '').trim())
    .filter(Boolean);

  return normalizeDocText(chunks.join('\n\n'));
}

/**
 * Rasterize PDF pages and run Tesseract (for scanned / image-only PDFs).
 */
async function ocrPdfBuffer(buffer) {
  const { getDocument } = await loadPdfJs();
  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    cMapUrl: pathToFileURL(path.join(pdfPackageRoot, 'cmaps/')).href,
    cMapPacked: true,
    standardFontDataUrl: pathToFileURL(path.join(pdfPackageRoot, 'standard_fonts/')).href,
    verbosity: 0,
  });

  const pdfDocument = await loadingTask.promise;
  const pageCap = ocrMaxPages();
  const pagesToScan = Math.min(pdfDocument.numPages, pageCap);

  const langs = process.env.TESSERACT_LANG || 'eng';
  const worker = await createWorker(langs);
  const parts = [];

  try {
    for (let i = 1; i <= pagesToScan; i++) {
      const page = await pdfDocument.getPage(i);
      const canvasFactory = pdfDocument.canvasFactory;
      if (!canvasFactory) {
        throw new Error('PDF renderer unavailable — @napi-rs/canvas should ship with pdfjs-dist.');
      }

      const baseVp = page.getViewport({ scale: 1 });
      const scale = Math.min(2.25, 1600 / Math.max(baseVp.width, 1));
      const viewport = page.getViewport({ scale });

      const canvasAndContext = canvasFactory.create(viewport.width, viewport.height);
      const canvasContext = canvasAndContext.context;
      canvasContext.save();
      canvasContext.fillStyle = '#ffffff';
      canvasContext.fillRect(0, 0, viewport.width, viewport.height);
      canvasContext.restore();

      const renderTask = page.render({
        canvasContext,
        viewport,
      });
      await renderTask.promise;

      const pngBuffer = canvasToPngBuffer(canvasAndContext.canvas);
      const {
        data: { text },
      } = await worker.recognize(pngBuffer, { tessedit_pageseg_mode: PSM.AUTO });

      const chunk = String(text || '').trim();
      if (chunk) parts.push(chunk);

      await Promise.resolve(page.cleanup());
      canvasFactory.destroy(canvasAndContext);
    }
  } finally {
    await worker.terminate();
    await pdfDocument.destroy().catch(() => {});
  }

  return parts.join('\n\n---\n\n').trim();
}

async function extractPdfForNote(buffer) {
  const direct = await extractPdfAsText(buffer);
  if (direct.length > 0) return { text: direct, usedOcr: false };
  try {
    const ocrText = await ocrPdfBuffer(buffer);
    return { text: ocrText, usedOcr: true };
  } catch (ocrErr) {
    const msg = ocrErr?.message || String(ocrErr);
    throw new Error(`Scan/OCR failed: ${msg}`);
  }
}

module.exports = {
  extractPdfAsText,
  ocrPdfBuffer,
  extractPdfForNote,
  extractWordFile,
};
