const express = require('express');
const supabase = require('../db');
const { requireAuth, requireAdmin } = require('../auth');
const router = express.Router();

router.use(requireAuth);

// GET all calendar events (optionally filtered by project or date range)
router.get('/', async (req, res) => {
  try {
    const { project, from, to } = req.query;
    let q = supabase.from('esg_calendar').select('*').order('deadline', { ascending: true });
    if (project) q = q.eq('project', project);
    if (from)    q = q.gte('deadline', from);
    if (to)      q = q.lte('deadline', to);
    const { data, error } = await q;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('GET /esg-calendar error:', err);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

// POST create — admin only
router.post('/', requireAdmin, async (req, res) => {
  try {
    let { project, sub_section, deliverable, deadline, notes } = req.body;
    project = (project || '').trim();
    deliverable = (deliverable || '').trim();
    if (!project || !deliverable || !deadline)
      return res.status(400).json({ error: 'Project, deliverable and deadline are required.' });

    const payload = {
      project,
      sub_section: (sub_section || '').trim() || null,
      deliverable,
      deadline,
      notes: (notes || '').trim() || null,
      status: 'pending',
      created_by: req.user.username,
    };
    const { data, error } = await supabase.from('esg_calendar').insert(payload).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('POST /esg-calendar error:', err);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

// PATCH update — admin only
router.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const allowed = ['project', 'sub_section', 'deliverable', 'deadline', 'notes', 'status'];
    const payload = { updated_at: new Date().toISOString() };
    for (const k of allowed) if (req.body[k] !== undefined) payload[k] = req.body[k];
    const { data, error } = await supabase
      .from('esg_calendar').update(payload).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('PATCH /esg-calendar error:', err);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

// DELETE — admin only
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { error } = await supabase.from('esg_calendar').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /esg-calendar error:', err);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

module.exports = router;
