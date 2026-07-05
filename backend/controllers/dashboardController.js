const { getDb, get, all } = require('../database/db');

exports.getDashboard = async (req, res) => {
  try {
    await getDb();
    const userId = req.user.id;

    const user = get('SELECT * FROM users WHERE id = ?', [userId]);

    const recentChats = all(
      'SELECT id, title, subject, updated_at FROM chats WHERE user_id = ? ORDER BY updated_at DESC LIMIT 5',
      [userId]
    ).map(c => {
      const msgCount = get('SELECT COUNT(*) as cnt FROM messages WHERE chat_id = ?', [c.id]);
      return { id: c.id, title: c.title, subject: c.subject, messageCount: msgCount.cnt, updatedAt: c.updated_at };
    });

    const recentQuizzes = all(
      'SELECT id, title, topic, score, total_score, attempted, created_at FROM quizzes WHERE user_id = ? ORDER BY created_at DESC LIMIT 5',
      [userId]
    ).map(q => ({
      id: q.id, title: q.title, topic: q.topic,
      score: q.score, totalScore: q.total_score,
      attempted: !!q.attempted, createdAt: q.created_at
    }));

    const recentNotes = all(
      'SELECT id, title, subject, word_count, created_at FROM notes WHERE user_id = ? ORDER BY created_at DESC LIMIT 5',
      [userId]
    );

    res.json({
      success: true,
      dashboard: {
        stats: {
          totalChats:   user.total_chats,
          totalQuizzes: user.total_quizzes,
          totalNotes:   user.total_notes,
          quizAvgScore: user.quiz_avg_score
        },
        recentChats,
        recentQuizzes,
        recentNotes
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
