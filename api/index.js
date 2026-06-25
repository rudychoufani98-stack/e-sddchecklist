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
const TILE_HOSTS = 'https://server.arcgisonline.com https://wayback.maptiles.arcgis.com https://elevation-tiles-prod.s3.amazonaws.com https://demotiles.maplibre.org https://s3-us-west-2.amazonaws.com';
const CSP = [
  "default-src 'self'",
  // Tailwind Play CDN + MapLibre need inline/eval; scripts limited to our CDNs
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com https://unpkg.com",
  "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  `img-src 'self' data: blob: ${TILE_HOSTS}`,
  `connect-src 'self' ${TILE_HOSTS}`,
  "worker-src 'self' blob:",            // MapLibre web worker
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Allow geolocation for our own origin (field-capture GPS); block camera/mic
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  res.setHeader('Content-Security-Policy', CSP);
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
app.use('/api/users',        require('../server/routes/users'));
app.use('/api/esg-calendar', require('../server/routes/esg-calendar'));
app.use('/api/map',          require('../server/routes/map'));
app.use('/api/chat',         require('../server/routes/chat'));

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
