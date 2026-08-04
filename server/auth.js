const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: admin only' });
  }
  next();
}

// Auditor (lender) accounts are confined to the grievance module for the single
// project they are scoped to. Everything else — other projects' due-diligence
// status, map geometry, documents, internal chat — is off limits, including via
// hand-crafted API calls that never touch the UI.
function denyAuditor(req, res, next) {
  if (req.user?.role === 'auditor') {
    return res.status(403).json({ error: 'Forbidden: auditor accounts are limited to their assigned project grievances.' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin, denyAuditor };
