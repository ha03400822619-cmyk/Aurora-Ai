const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { extractPdfForNote, extractWordFile } = require('../services/documentExtract');
const { chatCompletion } = require('../services/openRouter');
const { getDb, get, all, run, insert } = require('../database/db');

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

const NOTE_AI_ACTIONS = new Set(['summarize', 'explain_simple', 'key_points', 'flashcards']);

const isVercel = process.env.VERCEL === '1';
const UPLOAD_NOTES_DIR = isVercel 
  ? path.join('/tmp', 'uploads/notes') 
  : path.join(__dirname, '../uploads/notes');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(UPLOAD_NOTES_DIR)) fs.mkdirSync(UPLOAD_NOTES_DIR, { recursive: true });
    cb(null, UPLOAD_NOTES_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const allowedExtensions = ['.pdf', '.txt', '.doc', '.docx'];
const allowedMime = new Set([
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = String(file.mimetype || '').toLowerCase();
  if (allowedMime.has(mime)) return cb(null, true);
  if (allowedExtensions.includes(ext)) return cb(null, true);
  cb(new Error('Allowed types: PDF, TXT, Word (.doc, .docx).'), false);
};

exports.upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 },
});

function unlinkQuiet(p) {
  try {
    fs.unlinkSync(p);
  } catch (_) {
    /* ignore */
  }
}

function fileTypeFromExt(ext) {
  if (ext === '.pdf') return 'pdf';
  if (ext === '.txt') return 'txt';
  if (ext === '.doc') return 'doc';
  if (ext === '.docx') return 'docx';
  return 'file';
}

exports.uploadNote = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });

    let content = '';
    let extractedViaOcr = false;
    const ext = path.extname(req.file.originalname).toLowerCase();

    if (ext === '.pdf') {
      const dataBuffer = fs.readFileSync(req.file.path);
      try {
        const result = await extractPdfForNote(dataBuffer);
        content = result.text;
        extractedViaOcr = result.usedOcr;
      } catch (pdfErr) {
        unlinkQuiet(req.file.path);
        const msg =
          pdfErr?.message && /encrypt|password|protected/i.test(pdfErr.message)
            ? 'This PDF appears password-protected or encrypted.'
            : `Could not read PDF (${pdfErr?.message || 'unknown error'}).`;
        return res.status(400).json({ success: false, message: msg });
      }
    } else if (ext === '.txt') {
      content = fs.readFileSync(req.file.path, 'utf-8');
    } else if (ext === '.doc' || ext === '.docx') {
      try {
        content = await extractWordFile(ext, req.file.path);
      } catch (wErr) {
        unlinkQuiet(req.file.path);
        return res.status(400).json({
          success: false,
          message: `Could not read Word file (${wErr?.message || 'unknown error'}).`,
        });
      }
    }

    if (!content.trim()) {
      unlinkQuiet(req.file.path);
      let message = 'Could not extract text from file.';
      if (ext === '.pdf') {
        message =
          'Could not extract text from this PDF (including OCR). Try a clearer scan, another language (TESSERACT_LANG), or add the note manually.';
      } else if (ext === '.doc' || ext === '.docx') {
        message =
          'Could not extract text from this Word file. It may be corrupted, encrypted, or empty.';
      }
      return res.status(400).json({ success: false, message });
    }

    const wordCount = content.split(/\s+/).filter(Boolean).length;
    const title = req.body.title || path.basename(req.file.originalname, ext);
    const subject = req.body.subject || 'General';
    const fileType = fileTypeFromExt(ext);
    const limitedContent = content.substring(0, 50000);

    await getDb();
    const id = insert(
      'INSERT INTO notes (user_id, title, content, file_name, file_type, subject, word_count) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, title, limitedContent, req.file.originalname, fileType, subject, wordCount],
    );

    run('UPDATE users SET total_notes = total_notes + 1, updated_at = datetime("now") WHERE id = ?', [req.user.id]);

    unlinkQuiet(req.file.path);

    const note = get('SELECT id, title, subject, word_count, created_at FROM notes WHERE id = ?', [id]);
    res.status(201).json({ success: true, note: formatNote(note), extractedViaOcr });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createNote = async (req, res) => {
  try {
    const { title, content, subject } = req.body;
    if (!title || !content)
      return res.status(400).json({ success: false, message: 'Title and content required.' });

    const wordCount = content.split(/\s+/).filter(Boolean).length;

    await getDb();
    const id = insert(
      'INSERT INTO notes (user_id, title, content, file_type, subject, word_count) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, title, content, 'manual', subject || 'General', wordCount],
    );

    run('UPDATE users SET total_notes = total_notes + 1, updated_at = datetime("now") WHERE id = ?', [req.user.id]);

    const note = get('SELECT * FROM notes WHERE id = ?', [id]);
    res.status(201).json({ success: true, note: formatNote(note) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getNotes = async (req, res) => {
  try {
    await getDb();
    const notes = all(
      'SELECT id, title, subject, file_type, word_count, created_at FROM notes WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id],
    );
    res.json({ success: true, notes: notes.map(formatNoteListItem) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getNoteById = async (req, res) => {
  try {
    await getDb();
    const note = get('SELECT * FROM notes WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!note) return res.status(404).json({ success: false, message: 'Note not found.' });
    const outputs = all(
      'SELECT id, action, markdown, created_at, updated_at FROM note_ai_outputs WHERE note_id = ? AND user_id = ? ORDER BY created_at DESC',
      [req.params.id, req.user.id],
    );
    res.json({ success: true, note: formatNote(note), outputs: outputs.map(formatNoteAiOutput) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** PDF/text note → AI: summary, simple explanation, key points, flashcards (uses extracted note content). */
exports.noteAiPipeline = async (req, res) => {
  try {
    const action = String(req.body?.action || '').trim();
    if (!NOTE_AI_ACTIONS.has(action))
      return res.status(400).json({ success: false, message: 'Invalid action.' });

    await getDb();
    const note = get('SELECT * FROM notes WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!note) return res.status(404).json({ success: false, message: 'Note not found.' });

    const text = String(note.content || '').trim();
    if (!text)
      return res.status(400).json({ success: false, message: 'Note has no text to analyze.' });

    const clipped = text.substring(0, 14000);
    const title = String(note.title || 'Note');

    let userPrompt;
    switch (action) {
      case 'summarize':
        userPrompt = `Summarize the following study material titled "${title}". Use Markdown with ## headings and bullet lists where helpful. Be clear and concise.\n\n---\n${clipped}`;
        break;
      case 'explain_simple':
        userPrompt = `Explain the following study material in simple terms (like teaching a curious beginner). Use short sections and Markdown. Context title: "${title}".\n\n---\n${clipped}`;
        break;
      case 'key_points':
        userPrompt = `Extract the key points from the following study material. Use Markdown with ### subheadings if helpful and bullet lists. Title: "${title}".\n\n---\n${clipped}`;
        break;
      case 'flashcards':
        userPrompt = `Create study flashcards from the following material. Output Markdown only. For each card use exactly this shape:\n### Card N\n**Front:** question\n**Back:** short answer\n\nCreate 8–15 cards. Title context: "${title}".\n\n---\n${clipped}`;
        break;
      default:
        return res.status(400).json({ success: false, message: 'Invalid action.' });
    }

    const systemPrompt =
      'You are Aurora, a helpful study assistant. Follow the format instructions exactly. Use Markdown. Do not add a preamble like "Here is…".';

    let markdown;
    if (process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.trim()) {
      markdown = await chatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]);
    } else {
      if (!genAI) {
        return res.status(500).json({
          success: false,
          message: 'Configure OPENROUTER_API_KEY or GEMINI_API_KEY in backend .env.',
        });
      }
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent(`${systemPrompt}\n\n${userPrompt}`);
      markdown = result.response.text().trim();
    }

    const outputId = insert(
      'INSERT INTO note_ai_outputs (note_id, user_id, action, markdown) VALUES (?, ?, ?, ?)',
      [note.id, req.user.id, action, markdown],
    );
    const output = get('SELECT id, action, markdown, created_at, updated_at FROM note_ai_outputs WHERE id = ?', [outputId]);

    res.json({ success: true, action, markdown, output: formatNoteAiOutput(output) });
  } catch (err) {
    console.error('noteAiPipeline:', err);
    res.status(500).json({ success: false, message: err.message || 'AI request failed.' });
  }
};

exports.deleteNoteAiOutput = async (req, res) => {
  try {
    await getDb();
    const note = get('SELECT id FROM notes WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!note) return res.status(404).json({ success: false, message: 'Note not found.' });

    const output = get(
      'SELECT id FROM note_ai_outputs WHERE id = ? AND note_id = ? AND user_id = ?',
      [req.params.outputId, req.params.id, req.user.id],
    );
    if (!output) return res.status(404).json({ success: false, message: 'Generated result not found.' });

    run('DELETE FROM note_ai_outputs WHERE id = ?', [req.params.outputId]);
    res.json({ success: true, message: 'Generated result deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteNote = async (req, res) => {
  try {
    await getDb();
    const note = get('SELECT id FROM notes WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!note) return res.status(404).json({ success: false, message: 'Note not found.' });
    run('DELETE FROM notes WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Note deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const NOTE_CONTENT_MAX_LEN = 50000;

exports.updateNote = async (req, res) => {
  try {
    const { title, content, subject } = req.body;

    if (title === undefined || content === undefined) {
      return res.status(400).json({ success: false, message: 'Title and content are required.' });
    }

    const t = typeof title === 'string' ? title.trim() : '';
    let c = typeof content === 'string' ? content : '';
    const sub = typeof subject === 'string' && subject.trim() ? subject.trim() : 'General';

    if (!t) return res.status(400).json({ success: false, message: 'Title cannot be empty.' });
    if (!c.trim()) return res.status(400).json({ success: false, message: 'Content cannot be empty.' });
    if (c.length > NOTE_CONTENT_MAX_LEN) {
      return res.status(400).json({
        success: false,
        message: `Content is too long (max ${NOTE_CONTENT_MAX_LEN} characters).`,
      });
    }

    await getDb();
    const existing = get('SELECT id FROM notes WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!existing)
      return res.status(404).json({ success: false, message: 'Note not found.' });

    const wordCount = c.split(/\s+/).filter(Boolean).length;

    run(
      `UPDATE notes SET title = ?, content = ?, subject = ?, word_count = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`,
      [t, c, sub, wordCount, req.params.id, req.user.id],
    );

    const note = get('SELECT * FROM notes WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true, note: formatNote(note) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

function formatNote(n) {
  return {
    id: n.id,
    title: n.title,
    content: n.content,
    fileName: n.file_name,
    fileType: n.file_type,
    subject: n.subject,
    wordCount: n.word_count,
    createdAt: n.created_at,
    updatedAt: n.updated_at,
  };
}

function formatNoteListItem(n) {
  return {
    id: n.id,
    title: n.title,
    subject: n.subject,
    fileType: n.file_type,
    wordCount: n.word_count,
    createdAt: n.created_at,
  };
}

function formatNoteAiOutput(r) {
  return {
    id: r.id,
    action: r.action,
    markdown: r.markdown,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
