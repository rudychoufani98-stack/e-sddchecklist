require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { seedIfNeeded } = require('../server/seed');

const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // disabled to allow CDN tailwind
  crossOriginEmbedderPolicy: false,
}));

// Rate limit login endpoint — max 20 attempts per 15 min per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// API routes
app.use('/api/auth', authLimiter, require('../server/routes/auth'));
app.use('/api/sections', require('../server/routes/sections'));
app.use('/api/deliverables', require('../server/routes/deliverables'));
app.use('/api/files', require('../server/routes/files'));
app.use('/api/grievances', require('../server/routes/grievances'));
app.use('/api/grv-projects', require('../server/routes/grv-projects'));

// Serve React build
const buildDir = path.join(__dirname, '../client/build');
app.use(express.static(buildDir));
app.get('*', (req, res) => {
  res.sendFile(path.join(buildDir, 'index.html'));
});

seedIfNeeded().catch(console.error);

if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

module.exports = app;
