require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const { seedIfNeeded } = require('../server/seed');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', require('../server/routes/auth'));
app.use('/api/sections', require('../server/routes/sections'));
app.use('/api/deliverables', require('../server/routes/deliverables'));
app.use('/api/files', require('../server/routes/files'));

// Serve React build in production (Vercel serves static separately, this covers other hosts)
const buildPath = path.join(__dirname, '../client/build');
app.use(express.static(buildPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});

// Seed on cold start (idempotent — checks seed_done table first)
seedIfNeeded().catch(console.error);

if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

module.exports = app;
