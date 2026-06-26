const express = require('express');
const supabase = require('../db');
const { requireAuth } = require('../auth');
const router = express.Router();

router.use(requireAuth);

const TYPES = ['road', 'extraction', 'facility', 'facility_area'];

// Category-locked field consultants: their submissions are forced to this category/colour
const ROLE_CATEGORY = {
  consultant_env:      { category: 'Environmental',     color: '#22c55e' },
  consultant_social:   { category: 'Social',            color: '#3b82f6' },
  consultant_heritage: { category: 'Cultural Heritage', color: '#f59e0b' },
  consultant_hs:       { category: 'Health & Safety',   color: '#ef4444' },
};
// Field consultants may only CREATE (their own category points); editing/deleting
// existing features is limited to admin / construction / full consultant.
const CREATE_ROLES = ['admin', 'construction', 'consultant', ...Object.keys(ROLE_CATEGORY)];
const EDIT_ROLES = ['admin', 'construction', 'consultant'];

// GET all features (optionally filtered by project)
router.get('/', async (req, res) => {
  try {
    const { project } = req.query;
    let q = supabase.from('map_features').select('*').order('created_at', { ascending: true });
    if (project) q = q.eq('project', project);
    const { data, error } = await q;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('GET /map error:', err);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

// POST create a feature (admin or construction roles)
router.post('/', async (req, res) => {
  try {
    if (!CREATE_ROLES.includes(req.user?.role))
      return res.status(403).json({ error: 'Forbidden' });

    let { project, type, name, category, notes, color, coordinates } = req.body;
    project = (project || '').trim();
    name = (name || '').trim();
    if (!project || !name) return res.status(400).json({ error: 'Project and name are required.' });
    if (!TYPES.includes(type)) return res.status(400).json({ error: 'Invalid feature type.' });
    if (!coordinates || (Array.isArray(coordinates) && coordinates.length === 0))
      return res.status(400).json({ error: 'Coordinates are required.' });

    // Category-locked consultants can only create extraction points in their own category/colour
    const lock = ROLE_CATEGORY[req.user?.role];
    if (lock) { type = 'extraction'; category = lock.category; color = lock.color; }

    const payload = {
      project, type, name,
      category: (category || '').trim() || null,
      notes: (notes || '').trim() || null,
      color: color || null,
      coordinates,
      created_by: req.user.username,
    };
    const { data, error } = await supabase.from('map_features').insert(payload).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('POST /map error:', err);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

// PATCH update a feature
router.patch('/:id', async (req, res) => {
  try {
    if (!EDIT_ROLES.includes(req.user?.role))
      return res.status(403).json({ error: 'Forbidden' });
    const allowed = ['project', 'type', 'name', 'category', 'notes', 'color', 'coordinates'];
    const payload = { updated_at: new Date().toISOString() };
    for (const k of allowed) if (req.body[k] !== undefined) payload[k] = req.body[k];
    const { data, error } = await supabase
      .from('map_features').update(payload).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('PATCH /map error:', err);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

// DELETE a feature
router.delete('/:id', async (req, res) => {
  try {
    if (!EDIT_ROLES.includes(req.user?.role))
      return res.status(403).json({ error: 'Forbidden' });
    const { error } = await supabase.from('map_features').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /map error:', err);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

// ── Comments on a feature (extra details). Any signed-in user may read/post. ──
router.get('/:id/comments', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('feature_comments').select('*').eq('feature_id', req.params.id)
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('GET /map/:id/comments error:', err);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

router.post('/:id/comments', async (req, res) => {
  try {
    const body = (req.body.body || '').trim();
    if (!body) return res.status(400).json({ error: 'Comment is required.' });
    if (body.length > 2000) return res.status(400).json({ error: 'Comment too long.' });
    const { data, error } = await supabase
      .from('feature_comments')
      .insert({ feature_id: Number(req.params.id), username: req.user.username, body })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('POST /map/:id/comments error:', err);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

module.exports = router;
