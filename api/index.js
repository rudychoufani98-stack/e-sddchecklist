require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable is not set');

const express = require('express');
const cors = require('cors');
const path = require('path');
const { seedIfNeeded } = require('../server/seed');

const app = express();

// Restrict CORS to own origin in production
const allowedOrigin = process.env.FRONTEND_URL || 'https://e-sddchecklist.vercel.app';
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (server-to-server, curl) and the known frontend
    if (!origin || origin === allowedOrigin) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '2mb' }));

// Security headers manually (helmet not reliably available in Vercel serverless)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// API routes
app.use('/api/auth',        require('../server/routes/auth'));
app.use('/api/sections',    require('../server/routes/sections'));
app.use('/api/deliverables',require('../server/routes/deliverables'));
app.use('/api/files',       require('../server/routes/files'));
app.use('/api/grievances',    require('../server/routes/grievances'));
app.use('/api/grv-projects', require('../server/routes/grv-projects'));
app.use('/api/construction', require('../server/routes/construction'));

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
