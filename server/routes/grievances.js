const express = require('express');
const supabase = require('../db');
const { requireAuth, requireAdmin } = require('../auth');
const router = express.Router();

router.use(requireAuth);

// Auto-generate reference number GRV-001
async function nextRefNo() {
  const { data } = await supabase
    .from('grievances').select('reference_no').order('id', { ascending: false }).limit(1);
  if (!data || data.length === 0) return 'GRV-001';
  const last = data[0].reference_no || 'GRV-000';
  const num = parseInt(last.replace('GRV-', '')) + 1;
  return `GRV-${String(num).padStart(3, '0')}`;
}

// GET all grievances with filters
router.get('/', async (req, res) => {
  try {
    const { project_id, sub_section_id, status, risk_significance, escalation_level, from, to, search } = req.query;

    let q = supabase.from('grievances')
      .select('*, grv_projects(name), grv_sub_sections(name)')
      .order('created_at', { ascending: false });

    if (project_id)      q = q.eq('project_id', project_id);
    if (sub_section_id)  q = q.eq('sub_section_id', sub_section_id);
    if (status)          q = q.eq('status', status);
    if (risk_significance) q = q.eq('risk_significance', risk_significance);
    if (escalation_level)  q = q.eq('escalation_level', escalation_level);
    if (from)            q = q.gte('date_of_receipt', from);
    if (to)              q = q.lte('date_of_receipt', to);

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
    res.status(500).json({ error: err.message });
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
    res.json({ ...data, project_name: data.grv_projects?.name, sub_section_name: data.grv_sub_sections?.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create grievance
router.post('/', async (req, res) => {
  try {
    const refNo = await nextRefNo();
    const payload = { ...req.body, reference_no: refNo, submitted_by: req.user.username };
    delete payload.id;
    const { data, error } = await supabase.from('grievances').insert(payload).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH update grievance
router.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const payload = { ...req.body, updated_at: new Date().toISOString() };
    delete payload.id; delete payload.reference_no;
    const { data, error } = await supabase
      .from('grievances').update(payload).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE grievance
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { error } = await supabase.from('grievances').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET dashboard stats
router.get('/stats/summary', async (req, res) => {
  try {
    const { data: all, error } = await supabase.from('grievances').select('*');
    if (error) throw error;

    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const prevMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().split('T')[0];

    const open   = all.filter(g => g.status === 'open');
    const closed = all.filter(g => g.status === 'closed');

    const closureRate = all.length > 0 ? Math.round((closed.length / all.length) * 100) : 0;

    const newThisWeek  = all.filter(g => g.date_of_receipt >= weekAgo).length;
    const closedThisWeek = closed.filter(g => g.updated_at >= weekAgo).length;

    const thisMonthNew  = all.filter(g => g.date_of_receipt >= monthStart).length;
    const prevMonthNew  = all.filter(g => g.date_of_receipt >= prevMonthStart && g.date_of_receipt < monthStart).length;

    const overdue    = open.filter(g => g.deadline && g.deadline < today).length;
    const followUp   = open.filter(g => g.follow_up_required).length;
    const escalated  = all.filter(g => ['level_3_senior_management','level_4_external_mediator'].includes(g.escalation_level)).length;
    const highRisk   = all.filter(g => g.risk_significance === 'high').length;

    // By month (last 6 months)
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
      if (byMonth[key]) {
        byMonth[key].total++;
        if (g.status === 'closed') byMonth[key].closed++;
      }
    }

    // By nature type
    const byNature = {};
    for (const g of all) {
      const k = g.nature_type || 'unknown';
      byNature[k] = (byNature[k] || 0) + 1;
    }

    // By project
    const byProject = {};
    for (const g of all) {
      const k = g.project_id || 'unknown';
      if (!byProject[k]) byProject[k] = { open: 0, closed: 0 };
      byProject[k][g.status === 'open' ? 'open' : 'closed']++;
    }

    res.json({
      closureRate,
      totalOpen: open.length,
      totalClosed: closed.length,
      total: all.length,
      newThisWeek,
      closedThisWeek,
      thisMonthNew,
      prevMonthNew,
      trendUp: thisMonthNew >= prevMonthNew,
      overdue,
      followUp,
      escalated,
      highRisk,
      byMonth: Object.values(byMonth),
      byNature: Object.entries(byNature).map(([name, value]) => ({ name, value })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
