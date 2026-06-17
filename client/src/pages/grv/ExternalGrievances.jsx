import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import api from '../../api';

const NATURE_COLORS = [
  '#8B4513','#1a1a1a','#4169E1','#DAA520','#B22222',
  '#FF69B4','#708090','#9370DB','#A0522D','#2F4F4F','#191970',
];

const ESCALATION_LABELS = {
  level_1_site_team:         'L1 — Site Team',
  level_2_project_manager:   'L2 — Project Manager',
  level_3_senior_management: 'L3 — Senior Management',
  level_4_external_mediator: 'L4 — External Mediator',
};

const STATUS_META = {
  open:   { bg: 'bg-blue-50',  text: 'text-blue-700',  label: 'Open'   },
  closed: { bg: 'bg-gray-100', text: 'text-gray-600',  label: 'Closed' },
};
const RISK_META = {
  high:   { bg: 'bg-red-100',   text: 'text-red-700',   label: 'High'   },
  medium: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Medium' },
  low:    { bg: 'bg-green-100', text: 'text-green-700', label: 'Low'    },
};

function Badge({ type, value }) {
  const meta = type === 'risk' ? RISK_META[value] : STATUS_META[value];
  if (!meta) return <span className="text-xs text-gray-400 capitalize">{value || '—'}</span>;
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${meta.bg} ${meta.text}`}>{meta.label}</span>;
}

function KPICard({ label, value, sub, borderColor, valueColor, icon }) {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className={`h-1 ${borderColor}`} />
      <div className="p-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{label}</p>
        <div className="flex items-end gap-2">
          {icon && <span className="text-lg mb-0.5">{icon}</span>}
          <p className={`text-4xl font-black ${valueColor}`}>{value ?? '—'}</p>
        </div>
        {sub && <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
          <span className={`w-2 h-2 rounded-full inline-block ${borderColor}`} />
          {sub}
        </p>}
      </div>
    </div>
  );
}

export default function ExternalGrievances({ user }) {
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  const [tab, setTab] = useState('dashboard');
  const [grievances, setGrievances] = useState([]);
  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [closingId, setClosingId] = useState(null);

  // Filters
  const [filters, setFilters] = useState({
    project_id: '', sub_section_id: '', escalation_level: '', from: '', to: '',
    risk_significance: '',
  });
  const [search, setSearch] = useState('');

  const allSubSections = projects.flatMap(p =>
    (p.grv_sub_sections || []).map(s => ({ ...s, projectId: p.id }))
  ).filter(s => !filters.project_id || s.projectId === parseInt(filters.project_id));

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
      if (search) params.set('search', search);
      const [gRes, sRes, pRes] = await Promise.all([
        api.get(`/grievances?${params}`),
        api.get('/grievances/stats/summary'),
        api.get('/grv-projects'),
      ]);
      setGrievances(gRes.data);
      setStats(sRes.data);
      setProjects(pRes.data);
    } catch {}
    setLoading(false);
  }, [filters, search]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function toggleStatus(g) {
    const newStatus = g.status === 'open' ? 'closed' : 'open';
    setClosingId(g.id);
    try {
      await api.patch(`/grievances/${g.id}`, { status: newStatus });
      setGrievances(prev => prev.map(x => x.id === g.id ? { ...x, status: newStatus } : x));
      if (selected?.id === g.id) setSelected(s => ({ ...s, status: newStatus }));
      loadAll();
    } catch {}
    setClosingId(null);
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this grievance?')) return;
    await api.delete(`/grievances/${id}`).catch(() => {});
    setSelected(null);
    loadAll();
  }

  function exportCSV() {
    const cols = ['reference_no','date_of_receipt','project_name','sub_section_name','community_name','nature_type','nature_of_grievance','issue_description','risk_significance','priority_level','status','escalation_level','deadline','submitted_by'];
    const rows = [cols.join(','), ...displayed.map(g => cols.map(c => JSON.stringify(g[c] ?? '')).join(','))];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `grievances-${new Date().toISOString().split('T')[0]}.csv`; a.click();
  }

  const displayed = tab === 'open' ? grievances.filter(g => g.status === 'open')
    : tab === 'closed' ? grievances.filter(g => g.status === 'closed')
    : grievances;

  // Nature breakdown from current grievances
  const natureCounts = {};
  for (const g of grievances) {
    if (g.nature_of_grievance) {
      natureCounts[g.nature_of_grievance] = (natureCounts[g.nature_of_grievance] || 0) + 1;
    }
  }
  const natureData = Object.entries(natureCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const totalOpen   = grievances.filter(g => g.status === 'open').length;
  const totalClosed = grievances.filter(g => g.status === 'closed').length;
  const closureRate = grievances.length > 0 ? Math.round((totalClosed / grievances.length) * 100) : 0;
  const today = new Date().toISOString().split('T')[0];
  const overdue   = grievances.filter(g => g.status === 'open' && g.deadline && g.deadline < today).length;
  const escalated = grievances.filter(g => ['level_3_senior_management','level_4_external_mediator'].includes(g.escalation_level)).length;
  const followUp  = grievances.filter(g => g.follow_up_required).length;

  const TABS = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'all',       label: `All (${grievances.length})` },
    { key: 'open',      label: `Open (${totalOpen})` },
    { key: 'closed',    label: `Closed (${totalClosed})` },
  ];

  return (
    <div className="min-h-screen" style={{ background: '#FDF6E3' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* ── HEADER ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-4 mb-5">
          <div className="flex flex-wrap items-center gap-4">
            {/* Logo + title */}
            <div className="flex items-center gap-3 mr-4">
              <div className="w-14 h-14 bg-[#1a3c5e] rounded-xl flex items-center justify-center flex-shrink-0">
                <div className="text-center">
                  <div className="text-yellow-400 font-black text-xs leading-none">HITECH</div>
                  <div className="text-white font-black text-lg leading-none">H</div>
                </div>
              </div>
              <div>
                <h1 className="text-xl font-black text-[#1a3c5e]">Grievance Tracker</h1>
                <p className="text-xs text-gray-400">All Projects — 2025 &amp; 2026</p>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2 flex-1">
              <select value={filters.project_id} onChange={e => setFilters(f=>({...f, project_id: e.target.value, sub_section_id: ''}))}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#1a3c5e] min-w-[140px]">
                <option value="">Project — All</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={filters.sub_section_id} onChange={e => setFilters(f=>({...f, sub_section_id: e.target.value}))}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#1a3c5e] min-w-[140px]">
                <option value="">Sub Section — All</option>
                {allSubSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select value={filters.escalation_level} onChange={e => setFilters(f=>({...f, escalation_level: e.target.value}))}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#1a3c5e] min-w-[160px]">
                <option value="">Escalation — All</option>
                {Object.entries(ESCALATION_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <input type="date" value={filters.from} onChange={e => setFilters(f=>({...f, from: e.target.value}))}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]" />
              <input type="date" value={filters.to} onChange={e => setFilters(f=>({...f, to: e.target.value}))}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]" />
              {Object.values(filters).some(Boolean) && (
                <button onClick={() => setFilters({project_id:'',sub_section_id:'',escalation_level:'',from:'',to:'',risk_significance:''})}
                  className="px-3 py-2 text-xs font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                  Clear Filters
                </button>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button onClick={exportCSV} className="px-3 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Export CSV
              </button>
              <button onClick={() => navigate('/grv/submit')} className="px-3 py-2 text-xs font-semibold bg-[#1a3c5e] text-white rounded-lg hover:bg-[#122d47] transition-colors">
                + New
              </button>
            </div>
          </div>
        </div>

        {/* ── TABS ── */}
        <div className="flex gap-1 mb-5 bg-white/80 rounded-xl p-1 border border-amber-100 w-fit shadow-sm">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                tab === t.key ? 'bg-[#1a3c5e] text-white shadow-sm' : 'text-gray-500 hover:text-[#1a3c5e]'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ══════ DASHBOARD ══════ */}
        {tab === 'dashboard' && (
          <div className="space-y-5">

            {/* Risk filter pills */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Risk Significance</p>
              <div className="flex gap-2">
                {['high','medium','low'].map(r => (
                  <button key={r} onClick={() => setFilters(f => ({...f, risk_significance: f.risk_significance === r ? '' : r}))}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                      filters.risk_significance === r
                        ? r === 'high' ? 'bg-red-600 text-white border-red-600'
                          : r === 'medium' ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-green-600 text-white border-green-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                    }`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* KPI row 1 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard label="Total Grievances"  value={grievances.length} sub="All Grievances"         borderColor="bg-[#1a3c5e]" valueColor="text-[#1a3c5e]" />
              <KPICard label="Open Grievances"   value={totalOpen}         sub="Awaiting Resolution"    borderColor="bg-red-500"    valueColor="text-red-600"   icon="ⓘ" />
              <KPICard label="Closed Grievances" value={totalClosed}       sub="Successfully Resolved"  borderColor="bg-green-500"  valueColor="text-green-600" icon="ⓘ" />
              <KPICard label="Closure Rate (%)"  value={`${closureRate}%`} sub="Target: 80%"            borderColor="bg-[#1a3c5e]" valueColor="text-[#1a3c5e]" />
            </div>

            {/* KPI row 2 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KPICard label="Overdue Grievances"          value={overdue}   sub="Grievances to be followed" borderColor="bg-yellow-400" valueColor="text-yellow-600" />
              <KPICard label="Escalated Grievances"        value={escalated} sub="Require Attention"          borderColor="bg-yellow-400" valueColor="text-yellow-600" />
              <KPICard label="Grievances Requiring Follow-Up" value={followUp} sub="Action Pending"           borderColor="bg-yellow-400" valueColor="text-yellow-600" />
            </div>

            {/* Breakdown */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Breakdown</p>
              <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-5">
                <h3 className="text-base font-bold text-gray-800 mb-4 text-center">Nature of Grievances</h3>
                {natureData.length === 0 ? (
                  <div className="text-center py-12 text-gray-300 text-sm">No data</div>
                ) : (
                  <ResponsiveContainer width="100%" height={natureData.length * 36 + 40}>
                    <BarChart data={natureData} layout="vertical" margin={{ left: 220, right: 20, top: 5, bottom: 5 }}>
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={210} tick={{ fontSize: 11, fill: '#374151' }} />
                      <Tooltip formatter={(v) => [v, 'Grievances']} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                        {natureData.map((_, i) => <Cell key={i} fill={NATURE_COLORS[i % NATURE_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Monthly trend */}
            {stats?.byMonth && (
              <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-5">
                <h3 className="text-base font-bold text-gray-800 mb-4">Monthly Trend</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stats.byMonth} barSize={24}>
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="total"  name="Total"  fill="#1a3c5e" radius={[4,4,0,0]} />
                    <Bar dataKey="closed" name="Closed" fill="#16a34a" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* ══════ TABLE TABS ══════ */}
        {tab !== 'dashboard' && (
          <div>
            {/* Search */}
            <div className="mb-3 flex gap-2">
              <input type="text" placeholder="Search reference, community, description..." value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1 px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1a3c5e] bg-white shadow-sm" />
            </div>

            <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">{displayed.length} record{displayed.length !== 1 ? 's' : ''}</span>
                {tab === 'open' && <span className="text-xs text-gray-400">Click "Close" on any row to resolve a grievance</span>}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-gray-100 text-left">
                      {['Ref','Date','Project','Sub-section','Community','Nature','Risk','Status','Escalation','Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading && <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-400 text-sm">Loading...</td></tr>}
                    {!loading && displayed.length === 0 && <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-400 text-sm">No grievances found.</td></tr>}
                    {displayed.map(g => (
                      <tr key={g.id} className="hover:bg-amber-50/20 transition-colors group">
                        <td className="px-4 py-3 font-mono text-xs font-bold text-[#1a3c5e] whitespace-nowrap">{g.reference_no}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{g.date_of_receipt || '—'}</td>
                        <td className="px-4 py-3 text-xs font-medium text-gray-700 whitespace-nowrap">{g.project_name || '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{g.sub_section_name || '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{g.community_name || '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 max-w-[140px] truncate">{g.nature_of_grievance?.replace(/_/g,' ') || '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap"><Badge type="risk" value={g.risk_significance} /></td>
                        <td className="px-4 py-3 whitespace-nowrap"><Badge type="status" value={g.status} /></td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{ESCALATION_LABELS[g.escalation_level] || '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex gap-1.5">
                            <button onClick={() => setSelected(g)}
                              className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                              View
                            </button>
                            {isAdmin && (
                              <>
                                <button
                                  onClick={() => toggleStatus(g)}
                                  disabled={closingId === g.id}
                                  className={`px-2 py-1 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 ${
                                    g.status === 'open'
                                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                  }`}>
                                  {closingId === g.id ? '...' : g.status === 'open' ? 'Close' : 'Reopen'}
                                </button>
                                <button onClick={() => handleDelete(g.id)}
                                  className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors opacity-0 group-hover:opacity-100">
                                  Del
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── DETAIL PANEL ── */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-5 pt-4 pb-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="font-mono text-sm font-bold text-[#1a3c5e]">{selected.reference_no}</p>
                <p className="text-xs text-gray-400">{selected.project_name}{selected.sub_section_name ? ` — ${selected.sub_section_name}` : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <button onClick={() => toggleStatus(selected)} disabled={closingId === selected.id}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                      selected.status === 'open'
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}>
                    {closingId === selected.id ? '...' : selected.status === 'open' ? '✓ Mark Closed' : '↩ Reopen'}
                  </button>
                )}
                <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 p-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="px-5 py-4 space-y-2.5">
              {[
                ['Status',           <Badge type="status" value={selected.status} />],
                ['Risk',             <Badge type="risk"   value={selected.risk_significance} />],
                ['Date of Receipt',  selected.date_of_receipt],
                ['Community',        selected.community_name],
                ['Complainant',      selected.complaint_relationship?.replace(/_/g,' ')],
                ['Nature Type',      selected.nature_type],
                ['Nature of Grievance', selected.nature_of_grievance?.replace(/_/g,' ')],
                ['Issue Description',selected.issue_description],
                ['Proposed Resolution', selected.proposed_resolution],
                ['Priority',         selected.priority_level],
                ['Escalation',       ESCALATION_LABELS[selected.escalation_level]],
                ['Deadline',         selected.deadline],
                ['Follow-up Required', selected.follow_up_required ? 'Yes' : 'No'],
                ['Next Follow-up',   selected.next_follow_up_date],
                ['PDCA',             selected.pdca?.toUpperCase()],
                ['Lesson Learned',   selected.lesson_learned],
                ['Submitted by',     selected.submitted_by],
              ].filter(([,v]) => v && v !== '—').map(([label, value]) => (
                <div key={label} className="grid grid-cols-5 gap-2 py-1.5 border-b border-gray-50 last:border-0">
                  <span className="col-span-2 text-xs font-semibold text-gray-400 uppercase tracking-wide pt-0.5">{label}</span>
                  <span className="col-span-3 text-sm text-gray-800">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
