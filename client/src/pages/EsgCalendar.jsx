import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../api';

const PALETTE = ['#1a3c5e','#e63946','#2a9d8f','#e9a92b','#8338ec','#3a86ff','#fb5607','#06d6a0','#d62828','#457b9d','#9d4edd','#0aa1a1'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function dateKey(d) {
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function buildCalendar(year, month) {
  const first = new Date(year, month, 1);
  const startDay = (first.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
function fmtNice(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday:'short', day:'2-digit', month:'short', year:'numeric' });
}

export default function EsgCalendar({ user }) {
  const isAdmin = user?.role === 'admin';
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('month'); // month | agenda
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const [form, setForm] = useState(null); // {id?, project, sub_section, deliverable, deadline, notes}
  const [detail, setDetail] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get('/esg-calendar'); setEvents(r.data); } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  // Color per project (deterministic by sorted unique project list)
  const projects = useMemo(() => [...new Set(events.map(e => e.project))].sort(), [events]);
  const colorOf = useCallback(p => PALETTE[Math.max(0, projects.indexOf(p)) % PALETTE.length], [projects]);

  // Events grouped by date key
  const byDate = useMemo(() => {
    const m = {};
    for (const e of events) { (m[e.deadline] = m[e.deadline] || []).push(e); }
    return m;
  }, [events]);

  const cells = buildCalendar(cursor.getFullYear(), cursor.getMonth());
  const todayKey = dateKey(today);

  function openAdd(prefillDate) {
    setErr('');
    setForm({ project: '', sub_section: '', deliverable: '', deadline: prefillDate || dateKey(today), notes: '' });
  }
  function openEdit(ev) {
    setErr(''); setDetail(null);
    setForm({ id: ev.id, project: ev.project, sub_section: ev.sub_section || '', deliverable: ev.deliverable, deadline: ev.deadline, notes: ev.notes || '' });
  }

  async function save() {
    if (!form.project.trim() || !form.deliverable.trim() || !form.deadline) { setErr('Project, deliverable and deadline are required.'); return; }
    setSaving(true); setErr('');
    try {
      if (form.id) await api.patch(`/esg-calendar/${form.id}`, form);
      else         await api.post('/esg-calendar', form);
      setForm(null); load();
    } catch (e) { setErr(e.response?.data?.error || 'Could not save.'); }
    setSaving(false);
  }
  async function toggleDone(ev) {
    try { await api.patch(`/esg-calendar/${ev.id}`, { status: ev.status === 'done' ? 'pending' : 'done' }); setDetail(null); load(); } catch {}
  }
  async function remove(ev) {
    if (!window.confirm('Delete this deadline?')) return;
    try { await api.delete(`/esg-calendar/${ev.id}`); setDetail(null); load(); } catch {}
  }

  // Agenda: upcoming + overdue, sorted
  const agenda = [...events].sort((a,b) => a.deadline.localeCompare(b.deadline));

  return (
    <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-black text-[#1a3c5e]">ESG Calendar</h1>
          <p className="text-sm text-gray-500">Deliverable deadlines by project &amp; sub-section</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-white border border-amber-100 rounded-xl p-1 shadow-sm">
            {['month','agenda'].map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold capitalize transition-colors ${view===v ? 'bg-[#1a3c5e] text-white' : 'text-gray-500 hover:text-[#1a3c5e]'}`}>
                {v}
              </button>
            ))}
          </div>
          {isAdmin && (
            <button onClick={() => openAdd()}
              className="px-4 py-2 bg-[#1a3c5e] text-white text-sm font-bold rounded-xl hover:bg-[#122d47] transition-colors shadow-sm">
              + Add Deadline
            </button>
          )}
        </div>
      </div>

      {/* Project legend */}
      {projects.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-100 shadow-sm px-5 py-3 mb-5 flex flex-wrap gap-x-5 gap-y-2 items-center">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Projects</span>
          {projects.map(p => (
            <span key={p} className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
              <span className="w-3 h-3 rounded-sm" style={{ background: colorOf(p) }} />
              {p}
            </span>
          ))}
        </div>
      )}

      {loading && <div className="text-center py-16 text-gray-400">Loading…</div>}

      {/* ===== MONTH VIEW ===== */}
      {!loading && view === 'month' && (
        <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
          {/* Month nav */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth()-1, 1))}
              className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-500 flex items-center justify-center">‹</button>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-black text-[#1a3c5e]">{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</h2>
              <button onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
                className="text-xs font-semibold text-[#1a3c5e] border border-amber-200 rounded-lg px-2.5 py-1 hover:bg-amber-50">Today</button>
            </div>
            <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth()+1, 1))}
              className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-500 flex items-center justify-center">›</button>
          </div>

          {/* Weekday header */}
          <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/60">
            {WEEKDAYS.map(d => <div key={d} className="px-2 py-2 text-center text-[11px] font-bold text-gray-400 uppercase tracking-wider">{d}</div>)}
          </div>

          {/* Cells */}
          <div className="grid grid-cols-7">
            {cells.map((d, i) => {
              const key = d ? dateKey(d) : null;
              const dayEvents = key ? (byDate[key] || []) : [];
              const isToday = key === todayKey;
              return (
                <div key={i}
                  className={`min-h-[112px] border-b border-r border-gray-100 p-1.5 ${!d ? 'bg-gray-50/40' : 'bg-white hover:bg-amber-50/30'} ${i%7===6?'border-r-0':''} transition-colors`}
                  onClick={() => d && isAdmin && openAdd(key)}>
                  {d && (
                    <>
                      <div className="flex justify-end mb-1">
                        <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-[#1a3c5e] text-white' : 'text-gray-400'}`}>{d.getDate()}</span>
                      </div>
                      <div className="space-y-1">
                        {dayEvents.slice(0,4).map(ev => (
                          <button key={ev.id} onClick={e => { e.stopPropagation(); setDetail(ev); }}
                            className="w-full text-left px-1.5 py-1 rounded-md text-[11px] font-semibold text-white truncate hover:opacity-90"
                            style={{ background: colorOf(ev.project), opacity: ev.status==='done' ? 0.45 : 1 }}
                            title={`${ev.project}${ev.sub_section?' · '+ev.sub_section:''} — ${ev.deliverable}`}>
                            {ev.status==='done' && '✓ '}{ev.deliverable}
                          </button>
                        ))}
                        {dayEvents.length > 4 && (
                          <button onClick={e => { e.stopPropagation(); setView('agenda'); }}
                            className="text-[11px] font-bold text-gray-400 hover:text-[#1a3c5e] px-1.5">+{dayEvents.length-4} more</button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== AGENDA VIEW ===== */}
      {!loading && view === 'agenda' && (
        <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
          {agenda.length === 0 && <div className="text-center py-16 text-gray-400">No deadlines yet.{isAdmin && ' Click “Add Deadline”.'}</div>}
          <div className="divide-y divide-gray-50">
            {agenda.map(ev => {
              const overdue = ev.status !== 'done' && ev.deadline < todayKey;
              return (
                <button key={ev.id} onClick={() => setDetail(ev)}
                  className="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-amber-50/30 transition-colors">
                  <span className="w-1.5 h-10 rounded-full flex-shrink-0" style={{ background: colorOf(ev.project) }} />
                  <div className="w-32 flex-shrink-0">
                    <div className={`text-sm font-bold ${overdue ? 'text-red-600' : 'text-gray-700'}`}>{fmtNice(ev.deadline)}</div>
                    {overdue && <div className="text-[10px] font-bold text-red-500 uppercase">Overdue</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold truncate ${ev.status==='done'?'line-through text-gray-400':'text-gray-800'}`}>{ev.deliverable}</div>
                    <div className="text-xs text-gray-400 truncate">{ev.project}{ev.sub_section ? ` · ${ev.sub_section}` : ''}</div>
                  </div>
                  {ev.status === 'done' && <span className="text-xs font-bold text-green-600">✓ Done</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== ADD / EDIT MODAL ===== */}
      {form && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setForm(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-5 pb-3 border-b border-gray-100">
              <h3 className="text-lg font-black text-[#1a3c5e]">{form.id ? 'Edit Deadline' : 'Add Deadline'}</h3>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Project *</label>
                <input list="esg-projects" value={form.project} onChange={e => setForm(f => ({...f, project: e.target.value}))}
                  placeholder="e.g. LCCH 4" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]" />
                <datalist id="esg-projects">{projects.map(p => <option key={p} value={p} />)}</datalist>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Sub-Section</label>
                <input value={form.sub_section} onChange={e => setForm(f => ({...f, sub_section: e.target.value}))}
                  placeholder="optional" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Deliverable *</label>
                <input value={form.deliverable} onChange={e => setForm(f => ({...f, deliverable: e.target.value}))}
                  placeholder="e.g. Stakeholder Engagement Plan" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Deadline *</label>
                <input type="date" value={form.deadline} onChange={e => setForm(f => ({...f, deadline: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Notes</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e] resize-none" />
              </div>
              {err && <p className="text-sm text-red-600 font-semibold">{err}</p>}
            </div>
            <div className="px-6 pb-5 flex gap-3 justify-end">
              <button onClick={() => setForm(null)} className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">Cancel</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 text-sm font-bold bg-[#1a3c5e] text-white rounded-xl hover:bg-[#122d47] disabled:opacity-50">
                {saving ? 'Saving…' : form.id ? 'Save Changes' : 'Add Deadline'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== DETAIL MODAL ===== */}
      {detail && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="h-1.5" style={{ background: colorOf(detail.project) }} />
            <div className="px-6 py-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <h3 className="text-lg font-black text-gray-800">{detail.deliverable}</h3>
                <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex gap-2"><span className="w-24 text-gray-400 font-semibold">Project</span><span className="font-semibold text-gray-800">{detail.project}</span></div>
                {detail.sub_section && <div className="flex gap-2"><span className="w-24 text-gray-400 font-semibold">Sub-section</span><span className="text-gray-800">{detail.sub_section}</span></div>}
                <div className="flex gap-2"><span className="w-24 text-gray-400 font-semibold">Deadline</span><span className="text-gray-800">{fmtNice(detail.deadline)}</span></div>
                <div className="flex gap-2"><span className="w-24 text-gray-400 font-semibold">Status</span>
                  <span className={`font-bold ${detail.status==='done'?'text-green-600':'text-amber-600'}`}>{detail.status==='done'?'Done':'Pending'}</span></div>
                {detail.notes && <div className="flex gap-2"><span className="w-24 text-gray-400 font-semibold">Notes</span><span className="text-gray-700 whitespace-pre-wrap">{detail.notes}</span></div>}
              </div>
            </div>
            {isAdmin && (
              <div className="px-6 pb-5 flex gap-2 justify-end border-t border-gray-50 pt-4">
                <button onClick={() => toggleDone(detail)} className="px-3 py-2 text-xs font-bold rounded-lg bg-green-100 text-green-700 hover:bg-green-200">
                  {detail.status==='done' ? '↩ Mark Pending' : '✓ Mark Done'}
                </button>
                <button onClick={() => openEdit(detail)} className="px-3 py-2 text-xs font-bold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200">Edit</button>
                <button onClick={() => remove(detail)} className="px-3 py-2 text-xs font-bold rounded-lg bg-red-50 text-red-600 hover:bg-red-100">Delete</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
