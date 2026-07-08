const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getDb, get, all, run, insert } = require('../database/db');
const { chatCompletion: openRouterCompletion } = require('../services/openRouter');

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

exports.generateQuiz = async (req, res) => {
  try {
    const { topic, numQuestions = 5, difficulty = 'medium', noteContext } = req.body;

    if (!topic)
      return res.status(400).json({ success: false, message: 'Topic is required.' });

    let prompt = `Generate a multiple-choice quiz on: "${topic}"
Requirements:
- Exactly ${numQuestions} questions
- Difficulty: ${difficulty}
- Each question has exactly 4 options
- One correct answer per question (0-indexed: 0=first, 1=second, 2=third, 3=fourth)
- Include a brief explanation for each correct answer`;

    if (noteContext) {
      prompt += `\n\nBase the questions on this study material:\n${noteContext.substring(0, 12000)}`;
    }

    prompt += `\n\nRespond ONLY with a valid JSON array, no markdown, no extra text:
[
  {
    "question": "Question text?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": 0,
    "explanation": "Why this answer is correct."
  }
]`;

    let questionsRaw;
    if (process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.trim()) {
      questionsRaw = await openRouterCompletion([{ role: 'user', content: prompt }]);
    } else {
      if (!genAI) {
        return res.status(500).json({
          success: false,
          message: 'Configure OPENROUTER_API_KEY or GEMINI_API_KEY in backend .env.',
        });
      }
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent(prompt);
      questionsRaw = result.response.text().trim();
    }
    questionsRaw = questionsRaw.trim();
    questionsRaw = questionsRaw.replace(/```json|```/g, '').trim();

    let questions;
    try {
      questions = JSON.parse(questionsRaw);
    } catch (e) {
      return res.status(500).json({ success: false, message: 'Failed to parse quiz. Please try again.' });
    }

    
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(500).json({ success: false, message: 'Failed to generate a valid quiz. Please try again.' });
    }
    questions = questions
      .slice(0, Math.max(1, Math.min(50, Number(numQuestions) || 5)))
      .map((q) => {
        const opts = Array.isArray(q?.options) ? q.options.map(String) : [];
        const options = opts.slice(0, 4);
        while (options.length < 4) options.push('N/A');
        const correct = Number.isInteger(q?.correctAnswer) ? q.correctAnswer : 0;
        const correctAnswer = Math.min(3, Math.max(0, correct));
        return {
          question: String(q?.question || '').trim() || 'Question',
          options,
          correctAnswer,
          explanation: String(q?.explanation || '').trim(),
        };
      });

    await getDb();
    const id = insert(
      'INSERT INTO quizzes (user_id, title, topic, questions, total_score) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, `Quiz: ${topic}`, topic, JSON.stringify(questions), questions.length]
    );

    run('UPDATE users SET total_quizzes = total_quizzes + 1, updated_at = datetime("now") WHERE id = ?', [req.user.id]);

    const quiz = get('SELECT * FROM quizzes WHERE id = ?', [id]);
    res.status(201).json({ success: true, quiz: formatQuiz(quiz) });
  } catch (err) {
    console.error('Quiz generation error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.submitQuiz = async (req, res) => {
  try {
    const { answers, timeTaken } = req.body;
    await getDb();
    const quiz = get('SELECT * FROM quizzes WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found.' });
    if (quiz.attempted) return res.status(400).json({ success: false, message: 'Quiz already submitted.' });

    const questions = JSON.parse(quiz.questions);
    let score = 0;
    questions.forEach((q, i) => { if (answers[i] === q.correctAnswer) score++; });

    run('UPDATE quizzes SET answers = ?, score = ?, attempted = 1, time_taken = ?, updated_at = datetime("now") WHERE id = ?',
      [JSON.stringify(answers), score, timeTaken || 0, quiz.id]);

    recalcUserQuizAverage(req.user.id);

    const totalScore = getQuizTotalScore(quiz);
    res.json({ success: true, score, totalScore, percentage: Math.round((score / Math.max(1, totalScore)) * 100) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.resetQuizAttempt = async (req, res) => {
  try {
    await getDb();
    const quiz = get('SELECT * FROM quizzes WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found.' });

    run(
      'UPDATE quizzes SET attempted = 0, score = NULL, answers = ?, time_taken = 0, updated_at = datetime("now") WHERE id = ?',
      [JSON.stringify([]), quiz.id]
    );

    recalcUserQuizAverage(req.user.id);

    const refreshed = get('SELECT * FROM quizzes WHERE id = ?', [quiz.id]);
    res.json({ success: true, quiz: formatQuiz(refreshed) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getQuizzes = async (req, res) => {
  try {
    await getDb();
    const rows = all(
      'SELECT id, title, topic, score, total_score, attempted, time_taken, questions, created_at FROM quizzes WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    const quizzes = rows.map((q) => {
      const totalScore = getQuizTotalScore(q);
      return {
        id: q.id,
        title: q.title,
        topic: q.topic,
        score: q.score,
        total_score: totalScore,
        question_count: totalScore,
        attempted: q.attempted,
        time_taken: q.time_taken,
        created_at: q.created_at,
      };
    });
    res.json({ success: true, quizzes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getQuizById = async (req, res) => {
  try {
    await getDb();
    const quiz = get('SELECT * FROM quizzes WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found.' });
    res.json({ success: true, quiz: formatQuiz(quiz) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

function formatQuiz(q) {
  const questions = typeof q.questions === 'string' ? JSON.parse(q.questions) : (q.questions || []);
  const totalScore = Number(q.total_score) > 0 ? Number(q.total_score) : (Array.isArray(questions) ? questions.length : 0);
  return {
    id: q.id, title: q.title, topic: q.topic,
    questions,
    score: q.score, totalScore,
    attempted: !!q.attempted, timeTaken: q.time_taken,
    answers: typeof q.answers === 'string' ? JSON.parse(q.answers) : (q.answers || []),
    createdAt: q.created_at
  };
}

function getQuizTotalScore(quizRow) {
  const fromColumn = Number(quizRow?.total_score);
  if (Number.isFinite(fromColumn) && fromColumn > 0) return fromColumn;
  try {
    const parsed = typeof quizRow?.questions === 'string' ? JSON.parse(quizRow.questions) : quizRow?.questions;
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function recalcUserQuizAverage(userId) {
  const allAttempted = all('SELECT score, total_score FROM quizzes WHERE user_id = ? AND attempted = 1', [userId]);
  if (!allAttempted.length) {
    run('UPDATE users SET quiz_avg_score = 0, updated_at = datetime("now") WHERE id = ?', [userId]);
    return;
  }
  const avg =
    allAttempted.reduce((sum, q) => sum + ((Number(q.score) || 0) / Math.max(1, Number(q.total_score) || 0) * 100), 0)
    / allAttempted.length;
  run('UPDATE users SET quiz_avg_score = ?, updated_at = datetime("now") WHERE id = ?', [Math.round(avg), userId]);
}
