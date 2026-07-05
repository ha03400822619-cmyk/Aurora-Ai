const jwt = require('jsonwebtoken');
const { getDb, get } = require('../database/db');

const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token)
      return res.status(401).json({ success: false, message: 'Not authorized. Please log in.' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    await getDb();
    const user = get('SELECT * FROM users WHERE id = ?', [decoded.id]);

    if (!user)
      return res.status(401).json({ success: false, message: 'User no longer exists.' });

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid token. Please log in again.' });
  }
};

module.exports = { protect };
