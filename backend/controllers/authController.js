const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getDb, get, run, insert } = require('../database/db');

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

// Register
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ success: false, message: 'Please provide name, email, and password.' });

    if (password.length < 6)
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });

    await getDb();
    const existing = get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existing)
      return res.status(400).json({ success: false, message: 'Email already registered.' });

    const hashed = await bcrypt.hash(password, 12);
    const id = insert(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name.trim(), email.toLowerCase().trim(), hashed]
    );

    const user = get('SELECT * FROM users WHERE id = ?', [id]);
    const token = signToken(id);

    res.status(201).json({ success: true, token, user: formatUser(user) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Please provide email and password.' });

    await getDb();
    const user = get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    if (!user)
      return res.status(401).json({ success: false, message: 'Incorrect email or password.' });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ success: false, message: 'Incorrect email or password.' });

    const token = signToken(user.id);
    res.json({ success: true, token, user: formatUser(user) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get current user
exports.getMe = async (req, res) => {
  res.json({ success: true, user: formatUser(req.user) });
};

function formatUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    createdAt: u.created_at,
    stats: {
      totalChats:   u.total_chats,
      totalQuizzes: u.total_quizzes,
      totalNotes:   u.total_notes,
      quizAvgScore: u.quiz_avg_score
    }
  };
}
