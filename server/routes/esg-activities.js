const express = require('express');
const supabase = require('../db');
const { requireAuth, requireAdmin } = require('../auth');
const router = express.Router();

router.use(requireAuth);

// Returns the forced scope for auditor (lender) accounts, or null for everyone else.
function auditorScope(req) {
  if (req.user?.role !== 'auditor') return null;
  return {
    project_id: req.user.scope_project_id ?? null,
    sub_section_id: req.user.scope_sub_section_id ?? null,
  };
}

// GET all activities with filters
router.get('/', async (req, res) => {
  try {
    const { project_id, sub_section_id, from, to } = req.query;

    let q = supabase.from('esg_activities')
      .select('*, grv_projects(name), grv_sub_sections(name)')
      .order('activity_date', { ascending: false });

    const scope = auditorScope(req);
    const effProjectId = scope ? scope.project_id : project_id;
    const effSubId     = scope ? scope.sub_section_id : sub_section_id;

    if (effProjectId) q = q.eq('project_id', effProjectId);
    if (effSubId)     q = q.eq('sub_section_id', effSubId);
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
