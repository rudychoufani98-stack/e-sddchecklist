import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import api from '../../api';

const RISK_META = {
  high:   { bg: 'bg-red-100',    text: 'text-red-700',    label: 'High'   },
  medium: { bg: 'bg-amber-100',  text: 'text-amber-700',  label: 'Medium' },
  low:    { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Low'    },
};
const STATUS_META = {
  open:   { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'Open'   },
  closed: { bg: 'bg-gray-100',   text: 'text-gray-600',   label: 'Closed' },
};
const PIE_COLORS = ['#1a3c5e', '#e67e22', '#2ecc71', '#e74c3c', '#9b59b6'];

function Badge({ type, value }) {
  const meta = type === 'risk' ? RISK_META[value] : STATUS_META[value];
  if (!meta) return <span className="text-xs text-gray-400">{value || '—'}</span>;
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${meta.bg} ${meta.text}`}>
      {meta.label}
    </span>
  );
}

function KPICard({ label, value, sub, accent, icon }) {
  return (
    <div className={`bg-white rounded-xl p-4 border shadow-sm ${accent || 'border-gray-100'}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 font-medium">{label}</p>
          <p className="text-3xl font-black text-[#1a3c5e] mt-0.5">{value ?? '—'}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        {icon && <div className="text-gray-300">{icon}</div>}
      </div>
    </div>
  );
}

const ESCALATION_LABELS = {
  level_1_site_team: 'L1 — Site',
  level_2_project_manager: 'L2 — PM',
  level_3_senior_management: 'L3 — Senior',
  level_4_external_mediator: 'L4 — External',
};

export default function ExternalGrievances({ user }) {
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  const [tab, setTab] = useState('dashboard'); // dashboard | all | open | closed
  const [grievances, setGrievances] = useState([]);
  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ project_id: '', status: '', risk_significance: '', escalation_level: '', from: '', to: '' });
  const [selected, setSelected] = useState(null);
  const [deleting, setDeleting] = useState(false);

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

  const displayed = tab === 'open' ? grievances.filter(g => g.status === 'open')
    : tab === 'closed' ? grievances.filter(g => g.status === 'closed')
    : grievances;

  async function handleDelete(id) {
    if (!window.confirm('Delete this grievance?')) return;
    setDeleting(true);
    await api.delete(`/grievances/${id}`).catch(() => {});
    setDeleting(false);
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

  const TABS = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'all',       label: `All (${grievances.length})` },
    { key: 'open',      label: `Open (${grievances.filter(g=>g.status==='open').length})` },
    { key: 'closed',    label: `Closed (${grievances.filter(g=>g.status==='closed').length})` },
  ];

  return (
    <div className="min-h-screen bg-[#FDF6E3]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-2xl font-bold text-[#1a3c5e]">External Grievances</h2>
            <p className="text-sm text-gray-500 mt-0.5">HITECH Construction — ESG Data Collection</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
            <button
              onClick={() => navigate('/grv/submit')}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#1a3c5e] text-white text-xs font-medium rounded-lg hover:bg-[#122d47] transition-colors shadow-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Grievance
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-white/60 rounded-xl p-1 border border-amber-100 w-fit">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'bg-[#1a3c5e] text-white shadow-sm'
                  : 'text-gray-600 hover:text-[#1a3c5e]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ═══ DASHBOARD TAB ═══ */}
        {tab === 'dashboard' && stats && (
          <div className="space-y-5">
            {/* KPI grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KPICard label="Closure Rate" value={`${stats.closureRate}%`}
                sub={stats.trendUp ? '▲ vs last month' : '▼ vs last month'}
                accent={stats.closureRate >= 70 ? 'border-green-200' : 'border-amber-200'} />
              <KPICard label="Open Backlog" value={stats.totalOpen}
                accent={stats.totalOpen > 10 ? 'border-red-200' : 'border-gray-100'} />
              <KPICard label="Follow-up Required" value={stats.followUp}
                accent={stats.followUp > 0 ? 'border-amber-200' : 'border-gray-100'} />
              <KPICard label="New This Week" value={stats.newThisWeek} sub="new grievances" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KPICard label="Closed This Week" value={stats.closedThisWeek} accent="border-green-100" />
              <KPICard label="Overdue" value={stats.overdue} accent={stats.overdue > 0 ? 'border-red-300' : 'border-gray-100'} />
              <KPICard label="Escalated (L3+)" value={stats.escalated} accent={stats.escalated > 0 ? 'border-red-200' : 'border-gray-100'} />
              <KPICard label="High Risk" value={stats.highRisk} accent={stats.highRisk > 0 ? 'border-red-200' : 'border-gray-100'} />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Bar chart — grievances by month */}
              <div className="bg-white rounded-2xl p-5 border border-amber-100 shadow-sm">
                <h3 className="text-sm font-bold text-[#1a3c5e] mb-4">Grievances by Month</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stats.byMonth} barSize={28}>
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="total" name="Total" fill="#1a3c5e" radius={[4,4,0,0]} />
                    <Bar dataKey="closed" name="Closed" fill="#2e7d32" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Pie chart — by nature */}
              <div className="bg-white rounded-2xl p-5 border border-amber-100 shadow-sm">
                <h3 className="text-sm font-bold text-[#1a3c5e] mb-4">By Nature Type</h3>
                {stats.byNature.length === 0 ? (
                  <div className="flex items-center justify-center h-48 text-gray-300 text-sm">No data yet</div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={stats.byNature} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                        {stats.byNature.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ TABLE TABS ═══ */}
        {tab !== 'dashboard' && (
          <div>
            {/* Filters */}
            <div className="bg-white rounded-2xl p-4 border border-amber-100 shadow-sm mb-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <input
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="col-span-2 sm:col-span-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]"
                />
                <select value={filters.project_id} onChange={e => setFilters(f=>({...f,project_id:e.target.value}))} className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a3c5e] bg-white">
                  <option value="">All projects</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select value={filters.status} onChange={e => setFilters(f=>({...f,status:e.target.value}))} className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a3c5e] bg-white">
                  <option value="">All statuses</option>
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                </select>
                <select value={filters.risk_significance} onChange={e => setFilters(f=>({...f,risk_significance:e.target.value}))} className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a3c5e] bg-white">
                  <option value="">All risks</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <input type="date" value={filters.from} onChange={e => setFilters(f=>({...f,from:e.target.value}))} className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]" placeholder="From" />
                <input type="date" value={filters.to} onChange={e => setFilters(f=>({...f,to:e.target.value}))} className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]" placeholder="To" />
              </div>
              {(search || Object.values(filters).some(Boolean)) && (
                <button onClick={() => { setSearch(''); setFilters({project_id:'',status:'',risk_significance:'',escalation_level:'',from:'',to:''}); }} className="mt-2 text-xs text-gray-400 hover:text-red-500 underline">Clear filters</button>
              )}
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">{displayed.length} record{displayed.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50/70 border-b border-gray-100 text-left">
                      {['Ref #','Date','Project','Sub-section','Community','Nature','Risk','Status','Escalation','Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading && (
                      <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400 text-sm">Loading...</td></tr>
                    )}
                    {!loading && displayed.length === 0 && (
                      <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400 text-sm">No grievances found.</td></tr>
                    )}
                    {displayed.map(g => (
                      <tr key={g.id} className="hover:bg-amber-50/30 transition-colors group">
                        <td className="px-4 py-3 font-mono text-xs font-bold text-[#1a3c5e] whitespace-nowrap">{g.reference_no}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{g.date_of_receipt || '—'}</td>
                        <td className="px-4 py-3 text-xs font-medium text-gray-700 whitespace-nowrap">{g.project_name || '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{g.sub_section_name || '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{g.community_name || '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 capitalize whitespace-nowrap">{g.nature_type || '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap"><Badge type="risk" value={g.risk_significance} /></td>
                        <td className="px-4 py-3 whitespace-nowrap"><Badge type="status" value={g.status} /></td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{ESCALATION_LABELS[g.escalation_level] || '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setSelected(g)} className="px-2 py-1 text-xs bg-[#1a3c5e] text-white rounded-lg hover:bg-[#122d47]">View</button>
                            {isAdmin && (
                              <button onClick={() => handleDelete(g.id)} disabled={deleting} className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100">Delete</button>
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

      {/* Detail panel */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="font-mono text-sm font-bold text-[#1a3c5e]">{selected.reference_no}</p>
                <p className="text-xs text-gray-400">{selected.project_name} {selected.sub_section_name ? `— ${selected.sub_section_name}` : ''}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-3 text-sm">
              {[
                ['Date of Receipt', selected.date_of_receipt],
                ['Community', selected.community_name],
                ['Complainant', selected.complaint_relationship?.replace(/_/g,' ')],
                ['Nature Type', selected.nature_type],
                ['Nature of Grievance', selected.nature_of_grievance],
                ['Issue Description', selected.issue_description],
                ['Proposed Resolution', selected.proposed_resolution],
                ['Risk', selected.risk_significance],
                ['Priority', selected.priority_level],
                ['Status', selected.status],
                ['Escalation', ESCALATION_LABELS[selected.escalation_level]],
                ['Deadline', selected.deadline],
                ['Follow-up Required', selected.follow_up_required ? 'Yes' : 'No'],
                ['Next Follow-up', selected.next_follow_up_date],
                ['PDCA', selected.pdca?.toUpperCase()],
                ['Lesson Learned', selected.lesson_learned],
                ['Submitted by', selected.submitted_by],
              ].filter(([,v]) => v).map(([label, value]) => (
                <div key={label} className="grid grid-cols-2 gap-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
                  <span className="text-gray-800 text-sm">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
