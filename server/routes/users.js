const express = require('express');
const bcrypt = require('bcryptjs');
const supabase = require('../db');
const { requireAuth } = require('../auth');
const router = express.Router();

// Only this account may manage users.
const OWNER = 'rudy.choufani@skykapital.com';

function requireOwner(req, res, next) {
  if (req.user?.username !== OWNER) {
    return res.status(403).json({ error: 'Forbidden: user management is restricted.' });
  }
  next();
}

router.use(requireAuth);

// --- Self-service: change own password (any authenticated user) ---
router.post('/change-password', async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password)
      return res.status(400).json({ error: 'Current and new password are required.' });
    if (new_password.length < 8)
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });

    const { data: user, error } = await supabase
      .from('users').select('*').eq('username', req.user.username).single();
    if (error || !user) return res.status(404).json({ error: 'User not found.' });

    const ok = await bcrypt.compare(current_password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect.' });

    const hash = await bcrypt.hash(new_password, 10);
    await supabase.from('users').update({ password_hash: hash }).eq('username', req.user.username);
    res.json({ success: true });
  } catch (err) {
    console.error('change-password error:', err);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

// ===== Owner-only user management below =====
router.use(requireOwner);

const ROLES = ['admin', 'viewer', 'submitter', 'auditor', 'construction'];

// GET all users (no password hashes)
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users').select('username, role, scope_project_id, scope_sub_section_id').order('username');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('GET /users error:', err);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

// POST create a new user
router.post('/', async (req, res) => {
  try {
    let { username, password, role, scope_project_id, scope_sub_section_id } = req.body;
    username = (username || '').toLowerCase().trim();
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    if (!ROLES.includes(role)) role = 'viewer';

    // Auditor accounts must be locked to a project
    if (role === 'auditor' && !scope_project_id)
      return res.status(400).json({ error: 'Auditor accounts must be assigned to a project.' });
    if (role !== 'auditor') { scope_project_id = null; scope_sub_section_id = null; }
    if (role === 'construction') { scope_project_id = null; scope_sub_section_id = null; }

    const { data: existing } = await supabase.from('users').select('username').eq('username', username).single();
    if (existing) return res.status(409).json({ error: 'A user with that username already exists.' });

    const password_hash = await bcrypt.hash(password, 10);
    const { error } = await supabase.from('users').insert({
      username, password_hash, role,
      scope_project_id: scope_project_id || null,
      scope_sub_section_id: scope_sub_section_id || null,
    });
    if (error) throw error;
    res.status(201).json({ username, role });
  } catch (err) {
    console.error('POST /users error:', err);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

// PATCH update a user's role and/or reset password
router.patch('/:username', async (req, res) => {
  try {
    const target = decodeURIComponent(req.params.username).toLowerCase().trim();
    const { role, new_password, scope_project_id, scope_sub_section_id } = req.body;
    const payload = {};
    if (role !== undefined) {
      if (!ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role.' });
      if (target === OWNER && role !== 'admin')
        return res.status(400).json({ error: 'The owner account must remain an admin.' });
      payload.role = role;
      // Clear scope when leaving the auditor role
      if (role !== 'auditor') { payload.scope_project_id = null; payload.scope_sub_section_id = null; }
    }
    if (scope_project_id !== undefined)     payload.scope_project_id = scope_project_id || null;
    if (scope_sub_section_id !== undefined) payload.scope_sub_section_id = scope_sub_section_id || null;
    if (new_password !== undefined && new_password !== '') {
      if (new_password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
      payload.password_hash = await bcrypt.hash(new_password, 10);
    }
    if (!Object.keys(payload).length) return res.status(400).json({ error: 'Nothing to update.' });

    const { error } = await supabase.from('users').update(payload).eq('username', target);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('PATCH /users error:', err);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

// DELETE a user (cannot delete the owner)
router.delete('/:username', async (req, res) => {
  try {
    const target = decodeURIComponent(req.params.username).toLowerCase().trim();
    if (target === OWNER) return res.status(400).json({ error: 'The owner account cannot be deleted.' });
    const { error } = await supabase.from('users').delete().eq('username', target);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /users error:', err);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

module.exports = router;
