const express = require('express');
const supabase = require('../db');
const { requireAuth, requireAdmin } = require('../auth');
const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get('/', async (req, res) => {
  try {
    const { project, section, reporting_period } = req.query;
    let q = supabase.from('construction_progress').select('*').order('section').order('component');
    if (project)          q = q.ilike('project', `%${project}%`);
    if (section)          q = q.eq('section', section);
    if (reporting_period) q = q.eq('reporting_period', reporting_period);
    const { data, error } = await q;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

router.get('/periods', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('construction_progress')
      .select('reporting_period')
      .order('reporting_period', { ascending: false });
    if (error) throw error;
    const unique = [...new Set((data || []).map(r => r.reporting_period))];
    res.json(unique);
  } catch (err) {
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { pct_progress, status, remarks } = req.body;
    const payload = { updated_at: new Date().toISOString() };
    if (pct_progress !== undefined) payload.pct_progress = pct_progress;
    if (status !== undefined) payload.status = status;
    if (remarks !== undefined) payload.remarks = remarks;
    const { data, error } = await supabase
      .from('construction_progress').update(payload).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

module.exports = router;
