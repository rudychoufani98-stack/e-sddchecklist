const express = require('express');
const supabase = require('../db');
const { requireAuth } = require('../auth');
const router = express.Router();

router.use(requireAuth);

// GET recent messages (oldest → newest)
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('messages').select('*').order('created_at', { ascending: true }).limit(300);
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('GET /chat error:', err);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

// POST a message
router.post('/', async (req, res) => {
  try {
    const body = (req.body.body || '').trim();
    if (!body) return res.status(400).json({ error: 'Message is required.' });
    if (body.length > 2000) return res.status(400).json({ error: 'Message too long.' });
    const { data, error } = await supabase
      .from('messages').insert({ username: req.user.username, body }).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('POST /chat error:', err);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

module.exports = router;
