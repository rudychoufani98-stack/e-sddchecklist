const express = require('express');
const supabase = require('../db');
const { requireAuth, requireAdmin } = require('../auth');
const { auditorScope, applyScope, isInScope } = require('../scope');
const router = express.Router();

router.use(requireAuth);

async function nextRefNo() {
  const { data } = await supabase
    .from('grievances').select('reference_no').order('id', { ascending: false }).limit(1);
  if (!data || data.length === 0) return 'GRV-001';
  const last = data[0].reference_no || 'GRV-000';
  const num = parseInt(last.replace('GRV-', '')) + 1;
  return `GRV-${String(num).padStart(3, '0')}`;
}

// GET dashboard stats — MUST be before /:id
router.get('/stats/summary', async (req, res) => {
  try {
    let sq = supabase.from('grievances').select('*');
    sq = applyScope(sq, auditorScope(req));
    const { data: all, error } = await sq;
    if (error) throw error;

    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const prevMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().split('T')[0];

    const open   = all.filter(g => g.status === 'open');
    const closed = all.filter(g => g.status === 'closed');
    const closureRate = all.length > 0 ? Math.round((closed.length / all.length) * 100) : 0;

    const newThisWeek     = all.filter(g => g.date_of_receipt >= weekAgo).length;
    const closedThisWeek  = closed.filter(g => g.updated_at >= weekAgo).length;
    const thisMonthNew    = all.filter(g => g.date_of_receipt >= monthStart).length;
    const prevMonthNew    = all.filter(g => g.date_of_receipt >= prevMonthStart && g.date_of_receipt < monthStart).length;
    const overdue         = open.filter(g => g.deadline && g.deadline < today).length;
    const followUp        = open.filter(g => g.follow_up_required).length;
    const escalated       = all.filter(g => ['level_3_senior_management','level_4_external_mediator'].includes(g.escalation_level)).length;
    const highRisk        = all.filter(g => g.risk_significance === 'high').length;

    const byMonth = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i); d.setDate(1);
      const key = d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
      byMonth[key] = { month: key, total: 0, closed: 0 };
    }
    for (const g of all) {
      if (!g.date_of_receipt) continue;
      const d = new Date(g.date_of_receipt);
      const key = d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
      if (byMonth[key]) { byMonth[key].total++; if (g.status === 'closed') byMonth[key].closed++; }
    }

    const byNature = {};
    for (const g of all) {
      const k = g.nature_type || 'unknown';
      byNature[k] = (byNature[k] || 0) + 1;
    }

    res.json({
      closureRate, totalOpen: open.length, totalClosed: closed.length, total: all.length,
      newThisWeek, closedThisWeek, thisMonthNew, prevMonthNew,
      trendUp: thisMonthNew >= prevMonthNew,
      overdue, followUp, escalated, highRisk,
      byMonth: Object.values(byMonth),
      byNature: Object.entries(byNature).map(([name, value]) => ({ name, value })),
    });
  } catch (err) {
    console.error('stats/summary error:', err);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

// GET all grievances with filters
router.get('/', async (req, res) => {
  try {
    const { project_id, sub_section_id, status, risk_significance, escalation_level, nature_of_grievance, from, to, search } = req.query;

    let q = supabase.from('grievances')
      .select('*, grv_projects(name), grv_sub_sections(name)')
      .order('created_at', { ascending: false });

    // Auditor (lender) accounts are confined to their granted scope. Their own
    // filter choices are applied on top and combine with AND, so they can only
    // narrow within that scope, never widen beyond it.
    q = applyScope(q, auditorScope(req));

    if (project_id)        q = q.eq('project_id', project_id);
    // sub_section_id may be a comma-separated list (multi-select filter)
    if (sub_section_id) {
      const subIds = String(sub_section_id).split(',').map(n => parseInt(n)).filter(Number.isInteger);
      if (subIds.length > 1)        q = q.in('sub_section_id', subIds);
      else if (subIds.length === 1) q = q.eq('sub_section_id', subIds[0]);
    }
    if (status)            q = q.eq('status', status);
    if (risk_significance) q = q.eq('risk_significance', risk_significance);
    if (escalation_level)  q = q.eq('escalation_level', escalation_level);
    if (nature_of_grievance) q = q.eq('nature_of_grievance', nature_of_grievance);
    if (from)              q = q.gte('date_of_receipt', from);
    if (to)                q = q.lte('date_of_receipt', to);

    const { data, error } = await q;
    if (error) throw error;

    const enriched = (data || []).map(g => ({
      ...g,
      project_name:     g.grv_projects?.name,
      sub_section_name: g.grv_sub_sections?.name,
      grv_projects: undefined,
      grv_sub_sections: undefined,
    }));

    const filtered = search
      ? enriched.filter(g =>
          [g.reference_no, g.community_name, g.nature_of_grievance, g.issue_description, g.submitted_by]
            .some(f => f?.toLowerCase().includes(search.toLowerCase()))
        )
      : enriched;

    res.json(filtered);
  } catch (err) {
    console.error('GET /grievances error:', err);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

// GET single grievance
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('grievances')
      .select('*, grv_projects(name), grv_sub_sections(name)')
      .eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ error: 'Not found' });
    // Enforce auditor scope on direct record access
    if (!isInScope(data, auditorScope(req))) return res.status(404).json({ error: 'Not found' });
    res.json({ ...data, project_name: data.grv_projects?.name, sub_section_name: data.grv_sub_sections?.name });
  } catch (err) {
    console.error('GET /grievances/:id error:', err);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

// POST create grievance — only whitelisted fields accepted (auditors are read-only)
router.post('/', async (req, res) => {
  try {
    if (req.user.role === 'auditor') return res.status(403).json({ error: 'Auditor accounts are read-only.' });
    const refNo = await nextRefNo();
    const {
      date_of_receipt, date_of_registration, project_id, sub_section_id,
      complaint_relationship, community_name, nature_type, nature_of_grievance,
      issue_description, proposed_resolution, deadline,
      date_of_acknowledgment, next_follow_up_date, pdca, lesson_learned,
      status, risk_significance, priority_level, escalation_level, follow_up_required,
    } = req.body;

    // Validate field lengths
    if (issue_description && issue_description.length > 5000)
      return res.status(400).json({ error: 'issue_description too long (max 5000 chars)' });

    // Form-selected values are honored only when they match an allowed value;
    // anything else falls back to the safe default.
    const VALID = {
      status:            ['open', 'closed'],
      risk_significance: ['low', 'medium', 'high'],
      priority_level:    ['low', 'medium', 'high'],
      escalation_level:  ['level_1_site_team', 'level_2_project_manager', 'level_3_senior_management', 'level_4_external_mediator'],
    };
    const safeStatus = VALID.status.includes(status) ? status : 'open';

    const payload = {
      reference_no: refNo,
      submitted_by: req.user.username,
      status: safeStatus,
      closed_at: safeStatus === 'closed' ? new Date().toISOString() : null,
      risk_significance: VALID.risk_significance.includes(risk_significance) ? risk_significance : 'low',
      priority_level:    VALID.priority_level.includes(priority_level) ? priority_level : 'low',
      escalation_level:  VALID.escalation_level.includes(escalation_level) ? escalation_level : 'level_1_site_team',
      follow_up_required: follow_up_required === true,
      // Allowed submitter fields
      date_of_receipt, date_of_registration, project_id, sub_section_id,
      complaint_relationship, community_name, nature_type, nature_of_grievance,
      issue_description, proposed_resolution, deadline,
      date_of_acknowledgment, next_follow_up_date, pdca, lesson_learned,
    };

    const { data, error } = await supabase.from('grievances').insert(payload).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('POST /grievances error:', err);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

// PATCH update grievance — admin only
router.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const payload = { ...req.body, updated_at: new Date().toISOString() };
    delete payload.id; delete payload.reference_no;
    const { data, error } = await supabase
      .from('grievances').update(payload).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('PATCH /grievances/:id error:', err);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

// DELETE grievance — admin only
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { error } = await supabase.from('grievances').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /grievances/:id error:', err);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

module.exports = router;
