const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../db');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'estr4ck3r_jwt_fallback_secret_2026';

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .ilike('username', username)
    .single();

  if (error || !user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({ token, username: user.username, role: user.role });
});

module.exports = router;
