const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getDb, get, all, run, insert } = require('../database/db');
const { chatCompletion: openRouterCompletion } = require('../services/openRouter');

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

const IMAGE_DATA_URL_RE = /^data:image\/(png|jpeg|jpg|gif|webp);base64,/i;
const MAX_IMAGE_URL_CHARS = 12 * 1024 * 1024;

/** Max DB rows sent as chat context per request (full thread still stored for the UI). */
function historyMessageLimit() {
  const n = parseInt(String(process.env.CHAT_HISTORY_MESSAGE_LIMIT ?? '10'), 10);
  if (!Number.isFinite(n)) return 10;
  return Math.min(80, Math.max(2, n));
}

/** Optional cap on characters per past message in the API payload (0 = off). Saves tokens on huge replies. */
function historyMaxCharsPerMessage() {
  const n = parseInt(String(process.env.CHAT_HISTORY_MAX_MESSAGE_CHARS || '0'), 10);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(500_000, n);
}

function clipMessageForApi(content, maxChars) {
  const s = typeof content === 'string' ? content : '';
  if (!maxChars || s.length <= maxChars) return s;
  return `${s.slice(0, maxChars)}\n\n[…truncated for context limit]`;
}

function sanitizeImageUrls(raw) {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : [];
  const out = [];
  for (const u of arr.slice(0, 3)) {
    if (typeof u !== 'string' || !IMAGE_DATA_URL_RE.test(u) || u.length > MAX_IMAGE_URL_CHARS) continue;
    out.push(u);
  }
  return out;
}

function buildOpenRouterUserMessage(text, imageUrls) {
  const t = (text || '').trim() || 'What do you see in this image?';
  if (!imageUrls.length) return { role: 'user', content: t };
  return {
    role: 'user',
    content: [
      { type: 'text', text: t },
      ...imageUrls.map((url) => ({ type: 'image_url', image_url: { url } })),
    ],
  };
}

exports.sendMessage = async (req, res) => {
  try {
    const { message, chatId, noteContext, subject } = req.body;
    const imageUrls = sanitizeImageUrls(req.body.imageUrls);

    const trimmed = typeof message === 'string' ? message.trim() : '';
    if (!trimmed && !imageUrls.length)
      return res.status(400).json({ success: false, message: 'Message cannot be empty.' });

    if (
      imageUrls.length &&
      !(process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: 'Image uploads require OpenRouter (OPENROUTER_API_KEY). Remove the image or configure OpenRouter.',
      });
    }

    await getDb();
    let chat;

    if (chatId) {
      chat = get('SELECT * FROM chats WHERE id = ? AND user_id = ?', [chatId, req.user.id]);
      if (!chat) return res.status(404).json({ success: false, message: 'Chat not found.' });
    } else {
      const titleBase = trimmed || 'Photo';
      const title = titleBase.length > 50 ? titleBase.substring(0, 50) + '...' : titleBase;
      const newId = insert(
        'INSERT INTO chats (user_id, title, subject, note_context) VALUES (?, ?, ?, ?)',
        [req.user.id, title, subject || 'General', noteContext || '']
      );
      chat = get('SELECT * FROM chats WHERE id = ?', [newId]);
    }

    const contentForDb = trimmed + (imageUrls.length ? '\n\n📷 [Image attached]' : '');
    insert('INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)', [chat.id, 'user', contentForDb]);

    const histLimit = historyMessageLimit();
    const maxChars = historyMaxCharsPerMessage();
    const history = all(
      'SELECT role, content FROM messages WHERE chat_id = ? ORDER BY id DESC LIMIT ?',
      [chat.id, histLimit]
    ).reverse();

    // Build system prompt
    let systemPrompt = `You are Aurora, a smart and friendly AI assistant.
Help students understand academic topics clearly with examples and step-by-step explanations.
Be encouraging, focused, and educational. Keep answers concise but thorough.

Format answers for readability: use plain paragraphs by default, and use Markdown lists/headings only when they genuinely improve clarity.
Never wrap the entire response in bold or in a heading.`;

    const context = noteContext || chat.note_context;
    if (context) {
      systemPrompt += `\n\nStudent's uploaded notes (use these to answer questions):\n---\n${context.substring(0, 3000)}\n---`;
    }
    if (subject && subject !== 'General') {
      systemPrompt += `\nCurrent subject: ${subject}`;
    }

    let assistantMessage;

    const priorRows = history.slice(0, -1);

    if (process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.trim()) {
      const openRouterMessages = [
        { role: 'system', content: systemPrompt },
        ...priorRows.map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: clipMessageForApi(m.content, maxChars),
        })),
        buildOpenRouterUserMessage(trimmed, imageUrls),
      ];
      assistantMessage = await openRouterCompletion(openRouterMessages);
    } else {
      if (!genAI) {
        return res.status(500).json({
          success: false,
          message: 'Configure OPENROUTER_API_KEY or GEMINI_API_KEY in backend .env.',
        });
      }
      const geminiHistory = priorRows.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: clipMessageForApi(m.content, maxChars) }],
      }));

      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        systemInstruction: systemPrompt,
      });

      const geminiChat = model.startChat({ history: geminiHistory });
      const result = await geminiChat.sendMessage(trimmed);
      assistantMessage = result.response.text();
    }

    // Save AI reply
    insert('INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)', [chat.id, 'assistant', assistantMessage]);
    run('UPDATE chats SET updated_at = datetime("now") WHERE id = ?', [chat.id]);
    run('UPDATE users SET total_chats = total_chats + 1, updated_at = datetime("now") WHERE id = ?', [req.user.id]);

    res.json({
      success: true,
      chatId: chat.id,
      message: assistantMessage,
      chat: { id: chat.id, title: chat.title, subject: chat.subject }
    });
  } catch (err) {
    console.error('AI Chat Error:', err);
    res.status(500).json({ success: false, message: 'AI service error: ' + err.message });
  }
};

exports.getChats = async (req, res) => {
  try {
    await getDb();
    const chats = all('SELECT * FROM chats WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50', [req.user.id]);
    const chatList = chats.map(c => {
      const msgs = all('SELECT content FROM messages WHERE chat_id = ? ORDER BY id DESC LIMIT 1', [c.id]);
      const msgCount = get('SELECT COUNT(*) as cnt FROM messages WHERE chat_id = ?', [c.id]);
      return {
        id: c.id, title: c.title, subject: c.subject,
        messageCount: msgCount ? msgCount.cnt : 0,
        lastMessage: msgs.length ? msgs[0].content.substring(0, 80) : '',
        updatedAt: c.updated_at
      };
    });
    res.json({ success: true, chats: chatList });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getChatById = async (req, res) => {
  try {
    await getDb();
    const chat = get('SELECT * FROM chats WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!chat) return res.status(404).json({ success: false, message: 'Chat not found.' });
    const messages = all('SELECT * FROM messages WHERE chat_id = ? ORDER BY id ASC', [chat.id]);
    res.json({ success: true, chat: { ...chat, messages } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteChat = async (req, res) => {
  try {
    await getDb();
    run('DELETE FROM chats WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true, message: 'Chat deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
