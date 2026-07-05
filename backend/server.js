const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const { getDb } = require('./database/db');

dotenv.config();

function frontendOrigins() {
  return (process.env.FRONTEND_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

if (process.env.NODE_ENV === 'production' && !frontendOrigins().length) {
  console.warn('⚠️ Set FRONTEND_ORIGIN to your live site URL(s) so browsers can call this API.');
}

const app = express();

// Middleware — production: set FRONTEND_ORIGIN to your live site(s), comma-separated (e.g. https://you.github.io)
app.use(cors({
  credentials: true,
  origin:
    process.env.NODE_ENV === 'production'
      ? frontendOrigins()
      : true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth',    require('./routes/auth'));
app.use('/api/chat',    require('./routes/chat'));
app.use('/api/notes',   require('./routes/notes'));
app.use('/api/quiz',    require('./routes/quiz'));
app.use('/api/dashboard', require('./routes/dashboard'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', message: 'Aurora API running' }));

const frontendBuild = path.join(__dirname, '../frontend/build');
if (process.env.SERVE_FRONTEND === 'true' && fs.existsSync(frontendBuild)) {
  app.use(express.static(frontendBuild));
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(frontendBuild, 'index.html'));
  });
}

// Initialize SQLite and start server
getDb()
  .then(() => {
    console.log('✅ SQLite database initialized');
    app.listen(process.env.PORT || 5000, () => {
      console.log(`🚀 Server running on port ${process.env.PORT || 5000}`);
    });
  })
  .catch(err => {
    console.error('❌ Database initialization failed:', err.message);
    process.exit(1);
  });

module.exports = app;
