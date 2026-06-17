require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const { seedIfNeeded } = require('../server/seed');

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// API routes
app.use('/api/auth', require('../server/routes/auth'));
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
