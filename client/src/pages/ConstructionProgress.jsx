import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const STATUS_META = {
  'Completed':   { bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500'  },
  'In Progress': { bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500'   },
  'Not Started': { bg: 'bg-gray-100',   text: 'text-gray-500',   dot: 'bg-gray-400'   },
  'Delayed':     { bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500'    },
  'On Hold':     { bg: 'bg-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-500'  },
};

function pctColor(v) {
  if (v >= 80) return 'bg-green-500';
  if (v >= 50) return 'bg-blue-500';
  if (v >= 25) return 'bg-amber-400';
  return 'bg-red-400';
}

function ProgressBar({ value }) {
  const pct = Math.min(100, Math.max(0, value || 0));
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${pctColor(pct)}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-gray-700 w-10 text-right">{pct}%</span>
    </div>
  );
}

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META['Not Started'];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${m.bg} ${m.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {status || 'Not Started'}
    </span>
  );
}

export default function ConstructionProgress() {
  const [rows, setRows]           = useState([]);
  const [periods, setPeriods]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filters, setFilters]     = useState({ project: '', section: '', reporting_period: '' });
  const [editing, setEditing]     = useState(null); // { id, pct_progress, status, remarks }
  const [saving, setSaving]       = useState(false);
  const [view, setView]           = useState('table'); // 'table' | 'grid' | 'trend' | 'trend'
  const [allRows, setAllRows]     = useState([]); // unfiltered, for trend

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.project)          params.set('project', filters.project);
      if (filters.section)          params.set('section', filters.section);
      if (filters.reporting_period) params.set('reporting_period', filters.reporting_period);
      const [rRows, rPeriods, rAll] = await Promise.all([
        api.get(`/construction?${params}`),
        api.get('/construction/periods'),
        api.get('/construction'),
      ]);
      setRows(rRows.data);
      setPeriods(rPeriods.data);
      setAllRows(rAll.data);
    } catch {}
    setLoading(false);
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const projects  = [...new Set(rows.map(r => r.project))].filter(Boolean).sort();
  const sections  = [...new Set(rows.map(r => r.section))].filter(Boolean).sort();
  const components = [...new Set(rows.map(r => r.component))].filter(Boolean);

  // Overall progress per section
  const sectionSummary = sections.map(sec => {
    const secRows = rows.filter(r => r.section === sec && r.pct_progress !== null);
    const avg = secRows.length ? secRows.reduce((s, r) => s + Number(r.pct_progress), 0) / secRows.length : 0;
    return { section: sec, avg: Math.round(avg), count: secRows.length };
  });

  const overallAvg = rows.length
    ? Math.round(rows.filter(r => r.pct_progress !== null).reduce((s, r) => s + Number(r.pct_progress), 0) / rows.filter(r => r.pct_progress !== null).length)
    : 0;

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    try {
      await api.patch(`/construction/${editing.id}`, {
        pct_progress: editing.pct_progress,
        status: editing.status,
        remarks: editing.remarks,
      });
      setEditing(null);
      load();
    } catch {}
    setSaving(false);
  }

  // Grid view: components as rows, sections as columns
  const gridData = components.map(comp => ({
    component: comp,
    key_activities: rows.find(r => r.component === comp)?.key_activities || '',
    cells: sections.reduce((acc, sec) => {
      const row = rows.find(r => r.component === comp && r.section === sec);
      acc[sec] = row || null;
      return acc;
    }, {}),
  }));

  return (
    <div className="min-h-screen bg-[#f0f4f8]">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex flex-wrap items-center gap-4">
            <div className="mr-4">
              <h1 className="text-2xl font-black text-[#1a3c5e]">Construction Progress</h1>
              <p className="text-sm text-gray-400 mt-0.5">Activity-level progress tracking across all sections</p>
            </div>

            <div className="flex flex-wrap gap-2 flex-1">
              <select value={filters.reporting_period} onChange={e => setFilters(f => ({...f, reporting_period: e.target.value}))}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]">
                <option value="">Period — All</option>
                {periods.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select value={filters.project} onChange={e => setFilters(f => ({...f, project: e.target.value}))}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]">
                <option value="">Project — All</option>
                {projects.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select value={filters.section} onChange={e => setFilters(f => ({...f, section: e.target.value}))}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]">
                <option value="">Section — All</option>
                {sections.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {Object.values(filters).some(Boolean) && (
                <button onClick={() => setFilters({ project: '', section: '', reporting_period: '' })}
                  className="px-3 py-2 text-xs font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
                  Clear
                </button>
              )}
            </div>

            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {['table','grid','trend'].map(v => (
                <button key={v} onClick={() => setView(v)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors capitalize ${view === v ? 'bg-white text-[#1a3c5e] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Overall Progress</p>
            <p className="text-4xl font-black text-[#1a3c5e]">{overallAvg}%</p>
            <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${pctColor(overallAvg)}`} style={{ width: `${overallAvg}%` }} />
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Activities Tracked</p>
            <p className="text-4xl font-black text-[#1a3c5e]">{rows.length}</p>
            <p className="text-xs text-gray-400 mt-1">{components.length} components</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Completed</p>
            <p className="text-4xl font-black text-green-600">{rows.filter(r => Number(r.pct_progress) >= 100).length}</p>
            <p className="text-xs text-gray-400 mt-1">activities at 100%</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Sections</p>
            <p className="text-4xl font-black text-[#1a3c5e]">{sections.length}</p>
            <p className="text-xs text-gray-400 mt-1">across {projects.length} project{projects.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Section summary bars */}
        {sectionSummary.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wider">Progress by Section</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sectionSummary.map(s => (
                <div key={s.section} className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-gray-700">{s.section}</span>
                    <span className="text-sm font-bold text-gray-900">{s.avg}%</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${pctColor(s.avg)}`} style={{ width: `${s.avg}%` }} />
                  </div>
                  <p className="text-xs text-gray-400">{s.count} activities</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TABLE VIEW */}
        {view === 'table' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-700">{rows.length} activities</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-left">
                    {['Section','Sub-section','Component','Key Activity','Progress','Status','Remarks',''].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading && <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">Loading...</td></tr>}
                  {!loading && rows.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">No data found.</td></tr>}
                  {rows.map(r => (
                    <tr key={r.id} className="hover:bg-blue-50/20 transition-colors">
                      <td className="px-4 py-3 font-semibold text-[#1a3c5e] whitespace-nowrap">{r.section}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{r.sub_section || '—'}</td>
                      <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{r.component}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{r.key_activities}</td>
                      <td className="px-4 py-3 min-w-[160px]"><ProgressBar value={r.pct_progress} /></td>
                      <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-3 text-gray-400 text-xs max-w-[120px] truncate">{r.remarks || '—'}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => setEditing({ id: r.id, pct_progress: r.pct_progress, status: r.status || 'Not Started', remarks: r.remarks || '' })}
                          className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors">
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* GRID VIEW — components × sections */}
        {view === 'grid' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-[#1a3c5e] text-white">
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider sticky left-0 bg-[#1a3c5e] min-w-[220px]">Component</th>
                    {sections.map(s => (
                      <th key={s} className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider whitespace-nowrap min-w-[110px]">{s}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {gridData.map((row, i) => (
                    <tr key={row.component} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="px-4 py-3 sticky left-0 bg-inherit border-r border-gray-100">
                        <div className="font-semibold text-gray-800 text-sm">{row.component}</div>
                        <div className="text-xs text-gray-400 truncate max-w-[200px]">{row.key_activities}</div>
                      </td>
                      {sections.map(sec => {
                        const cell = row.cells[sec];
                        const pct = cell ? Number(cell.pct_progress) : null;
                        return (
                          <td key={sec} className="px-3 py-3 text-center">
                            {pct === null ? (
                              <span className="text-gray-300 text-xs">—</span>
                            ) : (
                              <div className="space-y-1">
                                <div className={`text-sm font-black ${pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-blue-600' : pct >= 25 ? 'text-amber-600' : 'text-red-500'}`}>
                                  {pct}%
                                </div>
                                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mx-2">
                                  <div className={`h-full rounded-full ${pctColor(pct)}`} style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

        {/* TREND VIEW — progress over time per component */}
        {view === 'trend' && (() => {
          const trendPeriods = [...new Set(allRows.map(r => r.reporting_period))].filter(Boolean).sort();
          const trendComponents = [...new Set(allRows.map(r => r.component))].filter(Boolean);
          const COLORS = ['#1a3c5e','#e63946','#2a9d8f','#e9c46a','#f4a261','#264653','#8338ec','#3a86ff','#fb5607','#06d6a0'];

          // For each period, compute avg progress per component across all sub-sections
          const trendData = trendPeriods.map(p => {
            const entry = { period: p.slice(0, 7) }; // YYYY-MM
            trendComponents.forEach(comp => {
              const compRows = allRows.filter(r => r.reporting_period === p && r.component === comp && r.pct_progress !== null);
              if (compRows.length) {
                entry[comp] = Math.round(compRows.reduce((s, r) => s + Number(r.pct_progress), 0) / compRows.length);
              }
            });
            return entry;
          });

          return (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-5 uppercase tracking-wider">Progress Trend — All Components Over Time</h3>
              <ResponsiveContainer width="100%" height={380}>
                <LineChart data={trendData} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0,100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v, name) => [`${v}%`, name]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {trendComponents.map((comp, i) => (
                    <Line key={comp} type="monotone" dataKey={comp} stroke={COLORS[i % COLORS.length]}
                      strokeWidth={2} dot={{ r: 4 }} connectNulls />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          );
        })()}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 mb-5">Update Progress</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Progress (%)</label>
                <input type="number" min="0" max="100"
                  value={editing.pct_progress}
                  onChange={e => setEditing(v => ({...v, pct_progress: Number(e.target.value)}))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1a3c5e] text-lg font-bold" />
                <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${pctColor(editing.pct_progress)}`} style={{ width: `${editing.pct_progress}%` }} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Status</label>
                <select value={editing.status} onChange={e => setEditing(v => ({...v, status: e.target.value}))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]">
                  {Object.keys(STATUS_META).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Remarks</label>
                <textarea rows={3} value={editing.remarks} onChange={e => setEditing(v => ({...v, remarks: e.target.value}))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1a3c5e] resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={saveEdit} disabled={saving}
                className="flex-1 py-2.5 bg-[#1a3c5e] text-white font-bold rounded-xl hover:bg-[#122d47] transition-colors disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditing(null)}
                className="px-6 py-2.5 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
