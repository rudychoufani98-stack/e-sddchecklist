import { useState, useEffect, useCallback } from 'react';
import api from '../api';

function fmt(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// Reusable comment thread for a map feature (extraction site / road).
export default function FeatureComments({ featureId, user, compact }) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    api.get(`/map/${featureId}/comments`)
      .then(r => { setComments(r.data); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [featureId]);
  useEffect(() => { load(); }, [load]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try { await api.post(`/map/${featureId}/comments`, { body }); setText(''); load(); }
    catch {}
    setSending(false);
  }

  return (
    <div>
      <div className={`space-y-2 ${compact ? 'max-h-40' : 'max-h-72'} overflow-y-auto pr-1`}>
        {!loaded ? (
          <p className="text-xs text-slate-400">Loading…</p>
        ) : comments.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No comments yet.</p>
        ) : comments.map(c => {
          const mine = c.username === user?.username;
          return (
            <div key={c.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] px-3 py-1.5 rounded-xl text-xs ${mine ? 'bg-[#1a3c5e] text-white' : 'bg-slate-100 text-slate-800'}`}>
                {!mine && <span className="block text-[10px] font-semibold text-slate-500 mb-0.5">{c.username.replace(/@.*/, '')}</span>}
                <span className="whitespace-pre-wrap break-words">{c.body}</span>
              </div>
              <span className="text-[9px] text-slate-400 mt-0.5">{fmt(c.created_at)}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-end gap-2 mt-2">
        <textarea value={text} onChange={e => setText(e.target.value)} rows={1}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Add a comment…"
          className="flex-1 resize-none px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#1a3c5e] max-h-20" />
        <button onClick={send} disabled={sending || !text.trim()}
          className="px-3 py-1.5 bg-[#1a3c5e] text-white text-xs font-bold rounded-lg hover:bg-[#122d47] disabled:opacity-40">
          Send
        </button>
      </div>
    </div>
  );
}
