import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api';

function fmtMsgTime(iso) {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
function dayLabel(iso) {
  const d = new Date(iso), today = new Date();
  const y = new Date(today); y.setDate(y.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });
}
function initials(name) { return (name || '?').replace(/@.*/, '').slice(0, 2).toUpperCase(); }
// Deterministic avatar colour per username
function avatarColor(name) {
  const colors = ['#1a3c5e', '#2a9d8f', '#e63946', '#8338ec', '#f4a261', '#3a86ff', '#06d6a0', '#d62828'];
  let h = 0; for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return colors[h % colors.length];
}

export default function ChatPage({ user }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const bodyRef = useRef(null);
  const atBottomRef = useRef(true);

  const fetchMsgs = useCallback(() => api.get('/chat')
    .then(r => { setMessages(r.data); setUnavailable(false); setLoaded(true); })
    .catch(err => { setLoaded(true); if (err.response?.status === 500) setUnavailable(true); }), []);

  useEffect(() => {
    fetchMsgs();
    const t = setInterval(fetchMsgs, 4000);
    return () => clearInterval(t);
  }, [fetchMsgs]);

  // Mark seen + autoscroll when messages change (only if user is at the bottom)
  useEffect(() => {
    const newest = messages.length ? new Date(messages[messages.length - 1].created_at).getTime() : 0;
    localStorage.setItem('chatLastSeen', String(newest));
    if (atBottomRef.current && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages]);

  function onScroll() {
    const el = bodyRef.current; if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await api.post('/chat', { body });
      setText('');
      atBottomRef.current = true;
      await fetchMsgs();
    } catch {}
    setSending(false);
  }

  // Group consecutive messages by day for date separators
  let lastDay = null;

  return (
    <div className="h-[calc(100vh-64px)] bg-[#FDF6E3] flex flex-col">
      <div className="max-w-3xl w-full mx-auto flex-1 flex flex-col min-h-0 px-4 py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <div>
            <h1 className="text-2xl font-black text-[#1a3c5e]">Team Chat</h1>
            <p className="text-sm text-slate-500">Shared conversation — everyone on the platform</p>
          </div>
          <span className="text-xs text-slate-400">{messages.length} message{messages.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Messages */}
        <div ref={bodyRef} onScroll={onScroll}
          className="flex-1 min-h-0 overflow-y-auto bg-white rounded-2xl border border-amber-100 shadow-sm px-4 py-4 space-y-1">
          {!loaded ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">Loading…</div>
          ) : unavailable ? (
            <div className="h-full flex items-center justify-center text-center text-amber-600 text-sm px-6">
              Chat isn’t set up yet — the <code className="mx-1">messages</code> table needs to be created in Supabase.
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm gap-1">
              <span className="text-3xl">💬</span> No messages yet. Say hello!
            </div>
          ) : messages.map(m => {
            const mine = m.username === user?.username;
            const day = dayLabel(m.created_at);
            const showDay = day !== lastDay; lastDay = day;
            return (
              <div key={m.id}>
                {showDay && (
                  <div className="flex justify-center my-3">
                    <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">{day}</span>
                  </div>
                )}
                <div className={`flex items-end gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                  {!mine && (
                    <span className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                      style={{ background: avatarColor(m.username) }}>{initials(m.username)}</span>
                  )}
                  <div className={`max-w-[75%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                    {!mine && <span className="text-[10px] font-semibold text-slate-500 mb-0.5 px-1">{m.username.replace(/@.*/, '')}</span>}
                    <div className={`px-3.5 py-2 rounded-2xl text-sm ${mine ? 'bg-[#1a3c5e] text-white rounded-br-sm' : 'bg-slate-50 border border-slate-100 text-slate-800 rounded-bl-sm'}`}>
                      <span className="whitespace-pre-wrap break-words">{m.body}</span>
                    </div>
                    <span className="text-[9px] text-slate-400 mt-0.5 px-1">{fmtMsgTime(m.created_at)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Composer */}
        {!unavailable && (
          <div className="mt-3 flex items-end gap-2 flex-shrink-0">
            <textarea value={text} onChange={e => setText(e.target.value)} rows={1}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Type a message…  (Enter to send, Shift+Enter for a new line)"
              className="flex-1 resize-none px-4 py-3 border border-slate-200 rounded-2xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1a3c5e] max-h-32" />
            <button onClick={send} disabled={sending || !text.trim()}
              className="px-5 py-3 bg-[#1a3c5e] text-white text-sm font-bold rounded-2xl hover:bg-[#122d47] disabled:opacity-40 transition-colors">
              Send
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
