const express = require('express');
const path = require('path');
const supabase = require('../db');
const { requireAuth, requireAdmin } = require('../auth');
const router = express.Router();

const BUCKET = 'data-room';
const ALLOWED_EXT = ['.pdf', '.docx', '.xlsx', '.png', '.jpg', '.jpeg', '.kmz', '.zip'];

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const { section_id } = req.query;
    let query = supabase
      .from('files')
      .select('*, sections(name), deliverables(title)')
      .order('uploaded_at', { ascending: false });
    if (section_id) query = query.eq('section_id', section_id);

    const { data, error } = await query;
    if (error) throw error;

    res.json(data.map((f) => ({
      ...f,
      section_name: f.sections?.name,
      deliverable_title: f.deliverables?.title,
      sections: undefined,
      deliverables: undefined,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin requests a signed upload URL — client uploads directly to Supabase Storage
router.post('/request-upload', requireAdmin, async (req, res) => {
  try {
    const { filename, section_id, deliverable_id } = req.body;
    if (!filename || !section_id) return res.status(400).json({ error: 'filename and section_id required' });

    const ext = path.extname(filename).toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) return res.status(400).json({ error: 'File type not allowed' });

    const storedPath = `${section_id}/${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;

    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(storedPath);
    if (error) throw error;

    res.json({ signedUrl: data.signedUrl, storedPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin confirms upload — saves metadata to DB
router.post('/confirm-upload', requireAdmin, async (req, res) => {
  try {
    const { storedPath, filename, section_id, deliverable_id } = req.body;
    if (!storedPath || !filename || !section_id) {
      return res.status(400).json({ error: 'storedPath, filename, and section_id required' });
    }

    const { data, error } = await supabase.from('files').insert({
      section_id,
      deliverable_id: deliverable_id || null,
      filename,
      stored_path: storedPath,
      uploaded_by: req.user.username,
    }).select().single();
    if (error) throw error;

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a signed download URL (auth required — redirects browser to Supabase)
router.get('/:id/download', async (req, res) => {
  try {
    const { data: file, error } = await supabase
      .from('files').select('*').eq('id', req.params.id).single();
    if (error || !file) return res.status(404).json({ error: 'File not found' });

    const { data: urlData, error: urlErr } = await supabase.storage
      .from(BUCKET).createSignedUrl(file.stored_path, 300);
    if (urlErr) throw urlErr;

    res.json({ signedUrl: urlData.signedUrl, filename: file.filename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { data: file, error } = await supabase
      .from('files').select('*').eq('id', req.params.id).single();
    if (error || !file) return res.status(404).json({ error: 'File not found' });

    await supabase.storage.from(BUCKET).remove([file.stored_path]);
    await supabase.from('files').delete().eq('id', req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
