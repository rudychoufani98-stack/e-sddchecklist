import { useState, useEffect, useCallback } from 'react';
import api from '../../api';

export default function ResolvingSolutions({ user }) {
  const [grievances, setGrievances] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [filterProject, setFilterProject] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [gRes, pRes] = await Promise.all([
        api.get('/grievances?status=closed'),
        api.get('/grv-projects'),
      ]);
      setGrievances(gRes.data);
      setProjects(pRes.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const displayed = grievances
    .filter(g => !filterProject || String(g.project_id) === filterProject)
    .filter(g => !search || [g.reference_no, g.community_name, g.nature_of_grievance, g.resolving_solution]
      .some(f => f?.toLowerCase().includes(search.toLowerCase())));

  const withSolution    = grievances.filter(g => g.resolving_solution).length;
  const withoutSolution = grievances.filter(g => !g.resolving_solution).length;

  return (
    <div className="min-h-screen" style={{ background: '#FDF6E3' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-5 mb-5">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3 mr-4">
              <svg width="44" height="44" viewBox="0 0 56 56" className="flex-shrink-0 rounded-lg" xmlns="http://www.w3.org/2000/svg">
                <rect width="56" height="56" fill="#FFD700"/>
                <rect x="2" y="2" width="52" height="52" fill="none" stroke="#CC0000" strokeWidth="4"/>
                <text x="28" y="14" textAnchor="middle" fill="#CC0000" fontFamily="Arial Black, sans-serif" fontWeight="900" fontSize="9" letterSpacing="0.5">HITECH</text>
                <text x="28" y="46" textAnchor="middle" fill="#CC0000" fontFamily="Arial Black, sans-serif" fontWeight="900" fontSize="34">H</text>
              </svg>
              <div>
                <h1 className="text-xl font-black text-[#1a3c5e]">Resolving Solutions</h1>
                <p className="text-xs text-gray-400">Closed grievances and their documented resolutions</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 flex-1">
              <input type="text" placeholder="Search reference, community, solution..." value={search}
                onChange={e => setSearch(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a3c5e] bg-white min-w-[220px]" />
              <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]">
                <option value="">All Projects</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {(search || filterProject) && (
                <button onClick={() => { setSearch(''); setFilterProject(''); }}
                  className="px-3 py-2 text-xs font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50">Clear</button>
              )}
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4 mb-5">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-amber-100">
            <div className="h-1 bg-[#1a3c5e]" />
            <div className="p-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total Closed</p>
              <p className="text-4xl font-black text-[#1a3c5e]">{grievances.length}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-amber-100">
            <div className="h-1 bg-green-500" />
            <div className="p-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">With Solution Documented</p>
              <p className="text-4xl font-black text-green-600">{withSolution}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-amber-100">
            <div className="h-1 bg-amber-400" />
            <div className="p-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Solution Pending</p>
              <p className="text-4xl font-black text-amber-600">{withoutSolution}</p>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">{displayed.length} record{displayed.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100 text-left">
                  {['Ref', 'Date Closed', 'Project', 'Community', 'Nature', 'Resolving Solution', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading && <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Loading...</td></tr>}
                {!loading && displayed.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">No closed grievances found.</td></tr>
                )}
                {displayed.map(g => (
                  <tr key={g.id} className="hover:bg-amber-50/20 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-[#1a3c5e] whitespace-nowrap">{g.reference_no}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {g.closed_at ? new Date(g.closed_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : g.updated_at ? new Date(g.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-gray-700 whitespace-nowrap">{g.project_name || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{g.community_name || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[140px] truncate">{g.nature_of_grievance?.replace(/_/g,' ') || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-700 max-w-[260px]">
                      {g.resolving_solution
                        ? <span className="line-clamp-2">{g.resolving_solution}</span>
                        : <span className="italic text-amber-500">Not documented</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setSelected(g)}
                        className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-5 pt-4 pb-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="font-mono text-sm font-bold text-[#1a3c5e]">{selected.reference_no}</p>
                <p className="text-xs text-gray-400">{selected.project_name}{selected.sub_section_name ? ` — ${selected.sub_section_name}` : ''}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Resolving Solution highlight */}
            <div className="px-5 pt-4">
              <div className={`rounded-xl p-4 mb-4 ${selected.resolving_solution ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                <p className="text-xs font-bold uppercase tracking-wider mb-2 ${selected.resolving_solution ? 'text-green-700' : 'text-amber-700'}">
                  {selected.resolving_solution ? 'Resolving Solution' : 'Resolving Solution — Not Documented'}
                </p>
                <p className="text-sm text-gray-800 leading-relaxed">
                  {selected.resolving_solution || <em className="text-amber-600">No resolving solution was recorded for this grievance.</em>}
                </p>
              </div>
            </div>

            <div className="px-5 pb-5 space-y-2">
              {[
                ['Date of Receipt',    selected.date_of_receipt],
                ['Closed At',         selected.closed_at ? new Date(selected.closed_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : null],
                ['Community',         selected.community_name],
                ['Nature Type',       selected.nature_type],
                ['Nature of Grievance', selected.nature_of_grievance?.replace(/_/g,' ')],
                ['Issue Description', selected.issue_description],
                ['Proposed Resolution', selected.proposed_resolution],
                ['PDCA',              selected.pdca?.toUpperCase()],
                ['Lesson Learned',    selected.lesson_learned],
                ['Submitted by',      selected.submitted_by],
              ].filter(([,v]) => v).map(([label, value]) => (
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
