const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../db');
const router = express.Router();

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable is not set');
const JWT_SECRET = process.env.JWT_SECRET;

// Brute-force protection: max 20 login attempts per IP per 15 min
const attempts = new Map();
function loginRateLimit(req, res, next) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip || 'unknown';
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const max = 20;
  const entry = attempts.get(ip) || { count: 0, start: now };
  if (now - entry.start > windowMs) {
    entry.count = 0; entry.start = now;
  }
  entry.count++;
  attempts.set(ip, entry);
  if (entry.count > max) {
    return res.status(429).json({ error: 'Too many login attempts. Try again in 15 minutes.' });
  }
  next();
}

router.post('/login', loginRateLimit, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  // Normalize to lowercase to prevent case confusion
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username.toLowerCase().trim())
    .single();

  if (error || !user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    {
      username: user.username,
      role: user.role,
      // Auditor (lender) accounts are locked to one project / sub-section
      scope_project_id: user.scope_project_id ?? null,
      scope_sub_section_id: user.scope_sub_section_id ?? null,
    },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({
    token,
    username: user.username,
    role: user.role,
    scope_project_id: user.scope_project_id ?? null,
    scope_sub_section_id: user.scope_sub_section_id ?? null,
  });
});

module.exports = router;
