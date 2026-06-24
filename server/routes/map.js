const express = require('express');
const supabase = require('../db');
const { requireAuth } = require('../auth');
const router = express.Router();

router.use(requireAuth);

const TYPES = ['road', 'extraction'];

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
    if (!['admin', 'construction'].includes(req.user?.role))
      return res.status(403).json({ error: 'Forbidden' });

    let { project, type, name, category, notes, color, coordinates } = req.body;
    project = (project || '').trim();
    name = (name || '').trim();
    if (!project || !name) return res.status(400).json({ error: 'Project and name are required.' });
    if (!TYPES.includes(type)) return res.status(400).json({ error: 'Invalid feature type.' });
    if (!coordinates || (Array.isArray(coordinates) && coordinates.length === 0))
      return res.status(400).json({ error: 'Coordinates are required.' });

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
    if (!['admin', 'construction'].includes(req.user?.role))
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
    if (!['admin', 'construction'].includes(req.user?.role))
      return res.status(403).json({ error: 'Forbidden' });
    const { error } = await supabase.from('map_features').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /map error:', err);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

module.exports = router;
