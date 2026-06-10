const express = require('express');
const supabase = require('../db');
const { requireAuth, requireAdmin } = require('../auth');
const router = express.Router();

router.use(requireAuth);

router.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const { status, delivery_date, comments } = req.body;

    const { data: existing, error: fetchErr } = await supabase
      .from('deliverables').select('*').eq('id', req.params.id).single();
    if (fetchErr || !existing) return res.status(404).json({ error: 'Deliverable not found' });

    const allowed = ['No', 'Ongoing', 'Yes'];
    if (status !== undefined && !allowed.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const update = {};
    if (status !== undefined) update.status = status;
    if (delivery_date !== undefined) update.delivery_date = delivery_date || null;
    if (comments !== undefined) update.comments = comments || null;

    const { data, error } = await supabase
      .from('deliverables').update(update).eq('id', req.params.id).select().single();
    if (error) throw error;

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await supabase.from('files').delete().eq('deliverable_id', req.params.id);
    const { error } = await supabase.from('deliverables').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
