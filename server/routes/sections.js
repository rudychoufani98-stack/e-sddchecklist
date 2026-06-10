const express = require('express');
const supabase = require('../db');
const { requireAuth, requireAdmin } = require('../auth');
const router = express.Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const { data: sections, error: sErr } = await supabase
      .from('sections').select('*').order('id');
    if (sErr) throw sErr;

    const { data: deliverables, error: dErr } = await supabase
      .from('deliverables').select('section_id, status').eq('is_doc_type', false);
    if (dErr) throw dErr;

    const result = sections.map((section) => {
      const items = deliverables.filter((d) => d.section_id === section.id);
      const total = items.length;
      const complete = items.filter((d) => d.status === 'Yes').length;
      const inProgress = items.filter((d) => d.status === 'Ongoing').length;
      const notStarted = items.filter((d) => d.status === 'No').length;
      const pct = total > 0 ? Math.round((complete / total) * 100) : 0;
      return { ...section, total, complete, inProgress, notStarted, pct };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Project name required' });
    const { data, error } = await supabase
      .from('sections').insert({ name: name.trim() }).select().single();
    if (error) throw error;
    res.status(201).json({ ...data, total: 0, complete: 0, inProgress: 0, notStarted: 0, pct: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await supabase.from('files').delete().eq('section_id', req.params.id);
    await supabase.from('deliverables').delete().eq('section_id', req.params.id);
    const { error } = await supabase.from('sections').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/deliverables', async (req, res) => {
  try {
    const { data: section, error: sErr } = await supabase
      .from('sections').select('*').eq('id', req.params.id).single();
    if (sErr || !section) return res.status(404).json({ error: 'Section not found' });

    const { data: deliverables, error: dErr } = await supabase
      .from('deliverables')
      .select('*')
      .eq('section_id', req.params.id)
      .order('is_doc_type', { ascending: true })
      .order('number', { ascending: true, nullsFirst: false });
    if (dErr) throw dErr;

    const ids = deliverables.map((d) => d.id);
    const { data: fileRows } = await supabase
      .from('files').select('deliverable_id').in('deliverable_id', ids.length ? ids : [0]);

    const countMap = {};
    (fileRows || []).forEach((f) => {
      if (f.deliverable_id) countMap[f.deliverable_id] = (countMap[f.deliverable_id] || 0) + 1;
    });

    const enriched = deliverables.map((d) => ({ ...d, fileCount: countMap[d.id] || 0 }));
    res.json({ section, deliverables: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/deliverables', requireAdmin, async (req, res) => {
  try {
    const { title, is_doc_type } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Title required' });

    const { data: existing } = await supabase
      .from('deliverables')
      .select('number')
      .eq('section_id', req.params.id)
      .eq('is_doc_type', false)
      .order('number', { ascending: false })
      .limit(1);

    const nextNumber = (existing && existing[0]?.number != null) ? existing[0].number + 1 : 1;

    const { data, error } = await supabase.from('deliverables').insert({
      section_id: parseInt(req.params.id),
      title: title.trim(),
      status: 'No',
      delivery_date: null,
      comments: null,
      is_doc_type: is_doc_type || false,
      number: is_doc_type ? null : nextNumber,
    }).select().single();
    if (error) throw error;

    res.status(201).json({ ...data, fileCount: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
