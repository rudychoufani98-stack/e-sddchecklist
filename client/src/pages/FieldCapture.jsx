import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import FeatureComments from '../components/FeatureComments';

// Role → fixed ESG category & pin colour (must match server/routes/map.js)
const ROLE_CATEGORY = {
  consultant_env:      { category: 'Environmental',    color: '#22c55e' },
  consultant_social:   { category: 'Social',           color: '#3b82f6' },
  consultant_heritage: { category: 'Cultural Heritage', color: '#f59e0b' },
  consultant_hs:       { category: 'Health & Safety',  color: '#ef4444' },
};

function fmtDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function FieldCapture({ user }) {
  const cat = ROLE_CATEGORY[user?.role] || { category: 'Other', color: '#9ca3af' };

  const [projects, setProjects] = useState([]);
  const [project, setProject] = useState('');
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [coords, setCoords] = useState(null); // [lng, lat]
  const [accuracy, setAccuracy] = useState(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [mine, setMine] = useState([]);
  const [expanded, setExpanded] = useState(null);

  const loadMine = useCallback(async () => {
    try {
      const r = await api.get('/map');
      setMine(r.data.filter(f => f.type === 'extraction' && f.created_by === user?.username)
        .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')));
    } catch {}
  }, [user]);

  useEffect(() => {
    api.get('/construction/structure')
      .then(r => { const p = r.data.projects || []; setProjects(p); setProject(s => s || p[0] || ''); })
      .catch(() => {});
    loadMine();
  }, [loadMine]);

  function flash(type, text) { setMsg({ type, text }); setTimeout(() => setMsg(null), 4000); }

  function useMyLocation() {
    if (!navigator.geolocation) { flash('error', 'This device has no location support.'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords([pos.coords.longitude, pos.coords.latitude]);
        setAccuracy(Math.round(pos.coords.accuracy));
        setLocating(false);
        flash('success', 'Location captured.');
      },
      (err) => {
        setLocating(false);
        flash('error', err.code === 1 ? 'Location permission denied. Allow it in your browser settings.' : 'Could not get your location. Try again outdoors.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  async function submit() {
    if (!project) { flash('error', 'Select a project.'); return; }
    if (!coords) { flash('error', 'Capture your location first.'); return; }
    if (!name.trim()) { flash('error', 'Give the point a short name.'); return; }
    setSaving(true);
    try {
      // Server forces category/colour by role; we send them too for older clients.
      await api.post('/map', {
        project, type: 'extraction', name: name.trim(),
        category: cat.category, color: cat.color, notes: notes.trim() || null,
        coordinates: coords,
      });
      flash('success', '✓ Extraction submitted.');
      setName(''); setNotes(''); setCoords(null); setAccuracy(null);
      loadMine();
    } catch { flash('error', 'Could not submit. Check your connection and try again.'); }
    setSaving(false);
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#FDF6E3] px-4 py-6">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-black" style={{ background: cat.color }}>📍</span>
          <div>
            <h1 className="text-xl font-black text-[#1a3c5e] leading-tight">Capture Extraction</h1>
            <p className="text-xs font-semibold" style={{ color: cat.color }}>{cat.category} Consultant</p>
          </div>
        </div>

        {msg && (
          <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-semibold ${msg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {msg.text}
          </div>
        )}

        {/* Capture card */}
        <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Project</label>
            <select value={project} onChange={e => setProject(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]">
              {projects.length === 0 && <option value="">Loading…</option>}
              {projects.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Location</label>
            <button onClick={useMyLocation} disabled={locating}
              className="w-full px-4 py-3 rounded-xl text-white font-bold text-sm transition-colors disabled:opacity-60"
              style={{ background: cat.color }}>
              {locating ? 'Getting your location…' : '📍 Use my current location'}
            </button>
            {coords && (
              <div className="mt-2 text-center text-xs text-slate-600">
                ✓ {coords[1].toFixed(6)}, {coords[0].toFixed(6)}{accuracy != null && <span className="text-slate-400"> · ±{accuracy}m</span>}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Name / what is it</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Sacred grove near km 14"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Observation details…"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]" />
          </div>

          <button onClick={submit} disabled={saving || !coords}
            className="w-full px-4 py-3 bg-[#1a3c5e] text-white font-bold rounded-xl hover:bg-[#122d47] disabled:opacity-50 transition-colors">
            {saving ? 'Submitting…' : 'Submit extraction'}
          </button>
        </div>

        {/* My recent submissions */}
        <div className="mt-6">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">My recent submissions ({mine.length})</p>
          {mine.length === 0 ? (
            <p className="text-sm text-slate-400">None yet. Capture your first point above.</p>
          ) : (
            <div className="space-y-2">
              {mine.slice(0, 20).map(f => (
                <div key={f.id} className="bg-white rounded-xl border border-amber-100 px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: f.color || cat.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{f.name}</p>
                      <p className="text-[11px] text-slate-400">{f.project} · {f.coordinates[1].toFixed(5)}, {f.coordinates[0].toFixed(5)} · {fmtDateTime(f.created_at)}</p>
                    </div>
                    <button onClick={() => setExpanded(expanded === f.id ? null : f.id)}
                      className="px-2.5 py-1 text-xs font-semibold text-[#1a3c5e] bg-blue-50 hover:bg-blue-100 rounded-lg flex-shrink-0">
                      💬 {expanded === f.id ? 'Hide' : 'Details'}
                    </button>
                  </div>
                  {expanded === f.id && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <FeatureComments featureId={f.id} user={user} compact />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
