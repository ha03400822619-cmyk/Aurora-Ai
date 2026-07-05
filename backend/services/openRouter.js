const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const DEFAULT_MODEL = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free';

/**
 * OpenAI-compatible chat completions via OpenRouter.
 * @param {Array<{ role: string, content: string | unknown[] }>} messages — user messages may use multimodal `content` arrays for vision.
 * @param {{ model?: string }} [opts]
 */
async function chatCompletion(messages, opts = {}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  const model = opts.model || process.env.OPENROUTER_MODEL || DEFAULT_MODEL;

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.APP_PUBLIC_URL || 'http://localhost:3000',
      'X-Title': 'Aurora',
    },
    body: JSON.stringify({ model, messages }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error?.message || data.message || `OpenRouter HTTP ${res.status}`;
    throw new Error(msg);
  }

  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('No assistant message in OpenRouter response');
  }
  return content.trim();
}

module.exports = { chatCompletion, DEFAULT_MODEL };
