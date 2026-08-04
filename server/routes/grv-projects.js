const express = require('express');
const supabase = require('../db');
const { requireAuth, requireAdmin } = require('../auth');
const { auditorScope } = require('../scope');
const router = express.Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('grv_projects').select('*, grv_sub_sections(*)').order('id');
    if (error) throw error;

    // Auditor (lender) accounts only see the projects they were granted, and
    // within a project only the sections they were granted.
    const scope = auditorScope(req);
    if (!scope) return res.json(data);

    const visible = (data || []).reduce((acc, p) => {
      const wholeProject = scope.projectIds.includes(p.id);
      const subs = (p.grv_sub_sections || []).filter(s =>
        wholeProject || scope.subSectionIds.includes(s.id));
      if (wholeProject || subs.length) acc.push({ ...p, grv_sub_sections: subs });
      return acc;
    }, []);

    res.json(visible);
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
