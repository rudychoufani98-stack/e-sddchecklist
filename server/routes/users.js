const express = require('express');
const bcrypt = require('bcryptjs');
const supabase = require('../db');
const { requireAuth } = require('../auth');
const { toIdArray, resolveScope } = require('../scope');
const router = express.Router();

// The multi-scope array columns only exist once scripts/add-auditor-multi-scope.sql
// has been run. Until then we transparently fall back to the single-value columns
// so user management keeps working (one project / one section per auditor).
let multiScopeReady = null;
async function hasMultiScope() {
  if (multiScopeReady !== null) return multiScopeReady;
  const { error } = await supabase.from('users').select('scope_project_ids').limit(1);
  multiScopeReady = !error;
  if (!multiScopeReady) {
    console.warn('users: scope_project_ids column missing — run scripts/add-auditor-multi-scope.sql to enable multi-project auditors.');
  }
  return multiScopeReady;
}

// Turns the request's scope fields into a DB payload, using array columns when
// available and degrading to the legacy single columns when they are not.
async function scopePayload(projectIds, subSectionIds) {
  const projects = toIdArray(projectIds, null);
  const subs     = toIdArray(subSectionIds, null);
  // The legacy columns are mirrored so a reader running the old code (e.g. mid
  // deploy) still sees a valid scope. They deliberately mirror the NARROWEST
  // target — never both null while a scope exists, which the old code would
  // have treated as unrestricted.
  const legacy = {
    scope_project_id:     subs.length ? null : (projects[0] ?? null),
    scope_sub_section_id: subs[0] ?? null,
  };
  if (await hasMultiScope()) {
    return { scope_project_ids: projects, scope_sub_section_ids: subs, ...legacy };
  }
  return legacy;
}

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

const ROLES = ['admin', 'viewer', 'submitter', 'auditor', 'construction', 'consultant',
  'consultant_env', 'consultant_social', 'consultant_heritage', 'consultant_hs'];

// GET all users (no password hashes)
router.get('/', async (req, res) => {
  try {
    const cols = (await hasMultiScope())
      ? 'username, role, scope_project_id, scope_sub_section_id, scope_project_ids, scope_sub_section_ids'
      : 'username, role, scope_project_id, scope_sub_section_id';
    const { data, error } = await supabase.from('users').select(cols).order('username');
    if (error) throw error;
    // Always hand the client arrays, whichever columns the DB has. resolveScope
    // is the same function the API enforces with, so the screen can never show a
    // wider scope than the one actually applied (a legacy project+section pair
    // means that section only, not the whole project).
    res.json((data || []).map(u => {
      const { projectIds, subSectionIds } = resolveScope(u);
      return {
        ...u,
        scope_project_ids: projectIds,
        scope_sub_section_ids: subSectionIds,
        multi_scope_enabled: multiScopeReady === true,
      };
    }));
  } catch (err) {
    console.error('GET /users error:', err);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

// POST create a new user
router.post('/', async (req, res) => {
  try {
    let { username, password, role, scope_project_ids, scope_sub_section_ids,
          scope_project_id, scope_sub_section_id } = req.body;
    username = (username || '').toLowerCase().trim();
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    if (!ROLES.includes(role)) role = 'viewer';

    // Accept either the array form or a single id (older clients)
    let projects = toIdArray(scope_project_ids, scope_project_id);
    let subs     = toIdArray(scope_sub_section_ids, scope_sub_section_id);

    // Auditor accounts must be granted at least one project or one section
    if (role === 'auditor' && !projects.length && !subs.length)
      return res.status(400).json({ error: 'Auditor accounts must be assigned at least one project or section.' });
    if (role !== 'auditor') { projects = []; subs = []; }

    const { data: existing } = await supabase.from('users').select('username').eq('username', username).single();
    if (existing) return res.status(409).json({ error: 'A user with that username already exists.' });

    // Any combination beyond a single grant needs the array columns
    if (role === 'auditor' && projects.length + subs.length > 1 && !(await hasMultiScope()))
      return res.status(400).json({ error: 'Granting more than one project/section needs the database migration: run scripts/add-auditor-multi-scope.sql in the Supabase SQL Editor.' });

    const password_hash = await bcrypt.hash(password, 10);
    const { error } = await supabase.from('users').insert({
      username, password_hash, role,
      ...(await scopePayload(projects, subs)),
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
    const { role, new_password, scope_project_ids, scope_sub_section_ids,
            scope_project_id, scope_sub_section_id } = req.body;
    const payload = {};
    if (role !== undefined) {
      if (!ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role.' });
      if (target === OWNER && role !== 'admin')
        return res.status(400).json({ error: 'The owner account must remain an admin.' });
      payload.role = role;
      // Clear scope when leaving the auditor role
      if (role !== 'auditor') Object.assign(payload, await scopePayload([], []));
    }
    // Scope is written as a whole set: send both lists together
    if (scope_project_ids !== undefined || scope_sub_section_ids !== undefined) {
      const projects = toIdArray(scope_project_ids, null);
      const subs     = toIdArray(scope_sub_section_ids, null);
      if (projects.length + subs.length > 1 && !(await hasMultiScope()))
        return res.status(400).json({ error: 'Granting more than one project/section needs the database migration: run scripts/add-auditor-multi-scope.sql in the Supabase SQL Editor.' });
      Object.assign(payload, await scopePayload(projects, subs));
    } else if (scope_project_id !== undefined || scope_sub_section_id !== undefined) {
      // Older single-value clients
      Object.assign(payload, await scopePayload(
        scope_project_id ? [scope_project_id] : [],
        scope_sub_section_id ? [scope_sub_section_id] : [],
      ));
    }
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
