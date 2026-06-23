const express = require('express');
const supabase = require('../db');
const { requireAuth, requireAdmin } = require('../auth');
const router = express.Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    let q = supabase.from('grv_projects').select('*, grv_sub_sections(*)').order('id');
    // Auditor (lender) accounts only see the project they are assigned to
    if (req.user?.role === 'auditor' && req.user.scope_project_id) {
      q = q.eq('id', req.user.scope_project_id);
    }
    const { data, error } = await q;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    const { data, error } = await supabase.from('grv_projects').insert({ name: name.trim() }).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/sub-sections', requireAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    const { data, error } = await supabase.from('grv_sub_sections')
      .insert({ name: name.trim(), project_id: parseInt(req.params.id) }).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await supabase.from('grv_sub_sections').delete().eq('project_id', req.params.id);
    const { error } = await supabase.from('grv_projects').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/sub-sections/:subId', requireAdmin, async (req, res) => {
  try {
    const { error } = await supabase.from('grv_sub_sections').delete().eq('id', req.params.subId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
