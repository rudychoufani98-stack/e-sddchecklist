const express = require('express');
const supabase = require('../db');
const { requireAuth, requireAdmin } = require('../auth');
const { auditorScope, applyScope } = require('../scope');
const router = express.Router();

router.use(requireAuth);

// GET all activities with filters
router.get('/', async (req, res) => {
  try {
    const { project_id, sub_section_id, from, to } = req.query;

    let q = supabase.from('esg_activities')
      .select('*, grv_projects(name), grv_sub_sections(name)')
      .order('activity_date', { ascending: false });

    // Auditor scope first; the client's own filters can only narrow it further.
    q = applyScope(q, auditorScope(req));

    if (project_id) q = q.eq('project_id', project_id);
    // sub_section_id may be a comma-separated list (multi-select filter)
    if (sub_section_id) {
      const subIds = String(sub_section_id).split(',').map(n => parseInt(n)).filter(Number.isInteger);
      if (subIds.length > 1)        q = q.in('sub_section_id', subIds);
      else if (subIds.length === 1) q = q.eq('sub_section_id', subIds[0]);
    }
    if (from)         q = q.gte('activity_date', from);
    if (to)           q = q.lte('activity_date', to);

    const { data, error } = await q;
    if (error) throw error;

    const enriched = (data || []).map(a => ({
      ...a,
      project_name:     a.grv_projects?.name,
      sub_section_name: a.grv_sub_sections?.name,
      grv_projects: undefined,
      grv_sub_sections: undefined,
    }));

    res.json(enriched);
  } catch (err) {
    console.error('GET /esg-activities error:', err);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

// POST create — admin only
router.post('/', requireAdmin, async (req, res) => {
  try {
    let { activity_date, project_id, sub_section_id, community_name, title, description, participants, conducted_by } = req.body;
    title = (title || '').trim();
    if (!activity_date || !title)
      return res.status(400).json({ error: 'Date and activity title are required.' });

    const payload = {
      activity_date,
      project_id:     project_id ? parseInt(project_id) : null,
      sub_section_id: sub_section_id ? parseInt(sub_section_id) : null,
      community_name: (community_name || '').trim() || null,
      title,
      description:    (description || '').trim() || null,
      participants:   participants !== '' && participants != null ? parseInt(participants) : null,
      conducted_by:   (conducted_by || '').trim() || null,
      created_by:     req.user.username,
    };
    const { data, error } = await supabase.from('esg_activities').insert(payload).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('POST /esg-activities error:', err);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

// PATCH update — admin only
router.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const allowed = ['activity_date', 'project_id', 'sub_section_id', 'community_name', 'title', 'description', 'participants', 'conducted_by'];
    const payload = { updated_at: new Date().toISOString() };
    for (const k of allowed) if (req.body[k] !== undefined) payload[k] = req.body[k];
    const { data, error } = await supabase
      .from('esg_activities').update(payload).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('PATCH /esg-activities error:', err);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

// DELETE — admin only
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { error } = await supabase.from('esg_activities').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /esg-activities error:', err);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

module.exports = router;
