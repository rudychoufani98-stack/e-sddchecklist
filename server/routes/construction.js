const express = require('express');
const supabase = require('../db');
const { requireAuth, requireAdmin } = require('../auth');
const router = express.Router();

router.use(requireAuth, requireAdmin);

// GET all rows with optional filters
router.get('/', async (req, res) => {
  try {
    const { project, section, reporting_period } = req.query;
    let q = supabase.from('construction_progress').select('*')
      .order('reporting_period', { ascending: false })
      .order('section').order('sub_section').order('component');
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

// GET distinct periods
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

// GET structure: projects, sections, sub_sections, components
router.get('/structure', async (req, res) => {
  try {
    const { data, error } = await supabase.from('construction_progress').select('project,section,sub_section,component,key_activities');
    if (error) throw error;
    const projects     = [...new Set(data.map(r => r.project))].filter(Boolean).sort();
    const sections     = [...new Set(data.map(r => r.section))].filter(Boolean).sort();
    const subSections  = [...new Set(data.map(r => r.sub_section))].filter(Boolean).sort();
    const components   = [...new Set(data.map(r => r.component))].filter(Boolean);
    // Map component → key_activities
    const componentMap = {};
    data.forEach(r => { if (r.component && !componentMap[r.component]) componentMap[r.component] = r.key_activities; });
    res.json({ projects, sections, subSections, components, componentMap });
  } catch (err) {
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

// POST bulk upsert for a period (Enter Progress form)
router.post('/bulk', async (req, res) => {
  try {
    const { reporting_period, project, entries } = req.body;
    if (!reporting_period || !project || !Array.isArray(entries))
      return res.status(400).json({ error: 'reporting_period, project, and entries required' });

    for (const e of entries) {
      const pct = parseFloat(e.pct_progress);
      if (isNaN(pct) || pct < 0 || pct > 100) continue;

      // Try update first, then insert
      const { data: existing } = await supabase.from('construction_progress')
        .select('id').eq('reporting_period', reporting_period)
        .eq('project', project).eq('sub_section', e.sub_section).eq('component', e.component).single();

      if (existing) {
        await supabase.from('construction_progress').update({
          pct_progress: pct,
          status: pct >= 100 ? 'Completed' : pct > 0 ? 'In Progress' : 'Not Started',
          remarks: e.remarks || null,
          updated_at: new Date().toISOString(),
        }).eq('id', existing.id);
      } else {
        await supabase.from('construction_progress').insert({
          reporting_period,
          project,
          section: e.section,
          sub_section: e.sub_section,
          component: e.component,
          key_activities: e.key_activities || '',
          pct_progress: pct,
          status: pct >= 100 ? 'Completed' : pct > 0 ? 'In Progress' : 'Not Started',
          remarks: e.remarks || null,
          prepared_by: req.user.username,
        });
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

// POST add new sub-section (Settings)
router.post('/sub-sections', async (req, res) => {
  try {
    const { project, section, sub_section } = req.body;
    if (!project || !section || !sub_section)
      return res.status(400).json({ error: 'project, section, sub_section required' });

    // Get existing components to create skeleton rows
    const { data: existing } = await supabase.from('construction_progress')
      .select('component,key_activities').eq('project', project).limit(100);
    const components = [...new Map((existing || []).map(r => [r.component, r.key_activities])).entries()];

    const rows = components.map(([component, key_activities]) => ({
      reporting_period: new Date().toISOString().split('T')[0].slice(0,8) + '01',
      project, section, sub_section, component, key_activities: key_activities || '',
      pct_progress: 0, status: 'Not Started', prepared_by: req.user.username,
    }));
    if (rows.length) await supabase.from('construction_progress').insert(rows);
    res.json({ success: true, created: rows.length });
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
