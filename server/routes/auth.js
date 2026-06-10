const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();

function getUsers() {
  return [
    { username: 'admin', password: process.env.ADMIN_PASSWORD, role: 'admin' },
    { username: 'rudy.choufani@skykapital.com', password: process.env.RUDY_PASSWORD, role: 'admin' },
    { username: 'skykapital', password: process.env.SKYKAPITAL_PASSWORD, role: 'viewer' },
    { username: 'hitech', password: process.env.HITECH_PASSWORD, role: 'viewer' },
  ];
}

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const users = getUsers();
  const user = users.find((u) => u.username.toLowerCase() === username.toLowerCase());
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const match = password === user.password;
  if (!match) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({ token, username: user.username, role: user.role });
});

module.exports = router;
