import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';

const COMPONENTS = [
  { name: 'Earthworks',                               key: 'Fill placement, shaping, grading, compaction' },
  { name: 'Pavement Formation',                       key: 'Stone base placement and trimming' },
  { name: 'Ground and pavement layer stabilization',  key: 'Treatment/improvement of subgrade and designated layers' },
  { name: 'Stormwater drainage works',                key: 'Installation of stormwater conveyance and associated drainage elements' },
  { name: 'Rigid pavement works',                     key: 'CRCP - continuously reinforced concrete pavement - preparation and placement' },
  { name: 'Structural and slope support works',       key: 'Retaining wall construction at required locations; road edge and finishing works' },
  { name: 'Kerb installation',                        key: 'Supply and installation of kerb units along road edges and medians' },
  { name: 'Road safety works',                        key: 'NJB - New Jersey barrier installation' },
  { name: 'Pedestrian works',                         key: 'Walkway construction' },
  { name: 'Solar Panels',                             key: 'Solar panel installation, mounting structures and grid connection' },
];

const COLORS = ['#1a3c5e','#e63946','#2a9d8f','#e9c46a','#f4a261','#264653','#8338ec','#3a86ff','#fb5607','#06d6a0'];

function pctBg(v) {
  if (v === null || v === undefined || v === '') return 'bg-slate-50 text-slate-300';
  const n = Number(v);
  if (n >= 100) return 'bg-green-100 text-green-800';
  if (n >= 75)  return 'bg-emerald-100 text-emerald-700';
  if (n >= 50)  return 'bg-blue-100 text-blue-700';
  if (n >= 25)  return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}
function pctBar(v) {
  const n = Number(v) || 0;
  if (n >= 100) return 'bg-green-500';
  if (n >= 75)  return 'bg-emerald-500';
  if (n >= 50)  return 'bg-blue-500';
  if (n >= 25)  return 'bg-amber-400';
  return 'bg-red-400';
}

function fmtPeriod(p) {
  if (!p) return '—';
  const d = new Date(p);
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

// Order by the section number embedded in the code/name (Section 1 before Section 2),
// then alphabetically. So SOK-1A, SOK-1B come before KEB-2A, KEB-2B.
function bySectionOrder(a, b) {
  const na = (String(a).match(/(\d+)/) || [])[1];
  const nb = (String(b).match(/(\d+)/) || [])[1];
  const da = na ? parseInt(na) : 999;
  const db = nb ? parseInt(nb) : 999;
  if (da !== db) return da - db;
  return String(a).localeCompare(String(b));
}

function StatCard({ label, value, accent }) {
  return (
    <div className="bg-white rounded-2xl border border-amber-100 shadow-sm px-5 py-4">
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{label}</p>
      <p className={`text-3xl font-black ${accent || 'text-slate-800'}`}>{value}</p>
    </div>
  );
}

export default function ConstructionProgress() {
  const [tab, setTab]             = useState('dashboard');
  const [allData, setAllData]     = useState([]);
  const [periods, setPeriods]     = useState([]);
  const [structure, setStructure] = useState({ projects: [], sections: [], subSections: [], components: [], componentMap: {}, subSectionsByProject: {} });
  const [loading, setLoading]     = useState(true);

  // Dashboard filters — no automatic filter; default shows latest cumulative data across all periods
  const [selPeriod,  setSelPeriod]  = useState('');
  const [selProject, setSelProject] = useState('');

  // Trend tab project filter
  const [trendProject, setTrendProject] = useState('');

  // Enter Progress state
  const [epPeriod,   setEpPeriod]   = useState('');
  const [epProject,  setEpProject]  = useState('LCCH');
  const [epGrid,     setEpGrid]     = useState({});
  const [epSaving,   setEpSaving]   = useState(false);
  const [epMsg,      setEpMsg]      = useState('');

  // Settings state
  const [newProject,    setNewProject]    = useState('');
  const [newSection,    setNewSection]    = useState('');
  const [newSubSection, setNewSubSection] = useState('');
  const [settingMsg,    setSettingMsg]    = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rAll, rPeriods, rStruct] = await Promise.all([
        api.get('/construction'),
        api.get('/construction/periods'),
        api.get('/construction/structure'),
      ]);
      setAllData(rAll.data);
      setPeriods(rPeriods.data);
      setStructure(rStruct.data);
      // NOTE: intentionally no auto-selected period — dashboard opens on "All Periods"
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Pre-fill Enter Progress grid with latest data
  useEffect(() => {
    if (!epPeriod || !allData.length) return;
    const grid = {};
    allData.filter(r => r.reporting_period === epPeriod && r.project === epProject).forEach(r => {
      grid[`${r.sub_section}||${r.component}`] = { pct: r.pct_progress ?? '', remarks: r.remarks || '' };
    });
    setEpGrid(grid);
  }, [epPeriod, epProject, allData]);

  // Derived data for dashboard (period + project filters only)
  const dashDataRaw = allData.filter(r =>
    (!selPeriod  || r.reporting_period === selPeriod) &&
    (!selProject || r.project === selProject)
  );

  // When no specific period is selected, collapse to the LATEST value per
  // project/sub-section/component so the section %, overall, and KPIs match
  // what the matrix shows (otherwise older months drag the averages down).
  const dashData = selPeriod ? dashDataRaw : (() => {
    const latest = {};
    dashDataRaw.forEach(r => {
      const k = `${r.project}||${r.sub_section}||${r.component}`;
      if (!latest[k] || (r.reporting_period || '') > (latest[k].reporting_period || '')) latest[k] = r;
    });
    return Object.values(latest);
  })();

  // Global KPI summary across the filtered set (latest value per project/sub/component when no period)
  const filledAll  = dashData.filter(r => r.pct_progress !== null);
  const overallAvg = filledAll.length ? Math.round(filledAll.reduce((s,r)=>s+Number(r.pct_progress),0)/filledAll.length) : 0;
  const completedCount  = dashData.filter(r => Number(r.pct_progress) >= 100).length;
  const inProgressCount = dashData.filter(r => Number(r.pct_progress) > 0 && Number(r.pct_progress) < 100).length;

  // Trend data — filtered by trendProject when set
  const trendBase = trendProject ? allData.filter(r => r.project === trendProject) : allData;
  const trendPeriods = [...new Set(trendBase.map(r => r.reporting_period))].filter(Boolean).sort();
  const trendData = trendPeriods.map(p => {
    const entry = { period: fmtPeriod(p) };
    COMPONENTS.forEach(({ name }) => {
      const rows = trendBase.filter(r => r.reporting_period === p && r.component === name && r.pct_progress !== null);
      if (rows.length) entry[name] = Math.round(rows.reduce((s,r) => s + Number(r.pct_progress), 0) / rows.length);
    });
    return entry;
  });

  const periodSummary = trendPeriods.map(p => {
    const rows = trendBase.filter(r => r.reporting_period === p && r.pct_progress !== null);
    return { period: fmtPeriod(p), avg: rows.length ? Math.round(rows.reduce((s,r) => s + Number(r.pct_progress), 0) / rows.length) : 0 };
  });

  const trendSections = [...new Set(trendBase.map(r => r.section))].filter(Boolean).sort(bySectionOrder);

  const epSubSections = (
    (structure.subSectionsByProject[epProject] || structure.subSections).slice().sort(bySectionOrder)
  ) || ['1A','1B','1C','2'];

  async function saveProgress() {
    if (!epPeriod) { setEpMsg('Select a reporting period first.'); return; }
    setEpSaving(true); setEpMsg('');
    const entries = [];
    COMPONENTS.forEach(({ name, key }) => {
      epSubSections.forEach(sub => {
        const val = epGrid[`${sub}||${name}`];
        if (val && val.pct !== '' && val.pct !== null) {
          entries.push({
            sub_section: sub,
            section: subToSection(sub),
            component: name,
            key_activities: key,
            pct_progress: val.pct,
            remarks: val.remarks || '',
          });
        }
      });
    });
    try {
      await api.post('/construction/bulk', { reporting_period: epPeriod, project: epProject, entries });
      setEpMsg(`✓ Saved ${entries.length} entries for ${fmtPeriod(epPeriod)}`);
      loadAll();
    } catch { setEpMsg('Error saving. Please try again.'); }
    setEpSaving(false);
  }

  async function addSubSection() {
    if (!newSection || !newSubSection) { setSettingMsg('Fill in section and sub-section.'); return; }
    try {
      await api.post('/construction/sub-sections', {
        project: newProject || 'LCCH', section: newSection, sub_section: newSubSection,
      });
      setSettingMsg(`✓ Added sub-section ${newSubSection} under ${newSection}`);
      setNewSubSection(''); loadAll();
    } catch { setSettingMsg('Error adding sub-section.'); }
  }

  function subToSection(sub) {
    if (['1A','1B','1C'].includes(sub)) return 'SECTION 1';
    if (sub === '2') return 'SECTION 2';
    if (['3A','3B'].includes(sub)) return 'SECTION 3';
    if (['4A','4B'].includes(sub)) return 'SECTION 4';
    const n = parseInt(sub); if (!isNaN(n) && n >= 5 && n <= 9) return `SECTION ${n}`;
    return sub;
  }

  const TABS = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'trend',     label: 'Trend' },
    { key: 'enter',     label: 'Enter Progress' },
    { key: 'settings',  label: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-[#FDF6E3]">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Construction Progress</h1>
            <p className="text-sm text-slate-400 mt-0.5">Monthly construction reporting across all projects</p>
          </div>
          <div className="flex gap-1 bg-white border border-amber-100 rounded-xl p-1 shadow-sm">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t.key ? 'bg-[#1a3c5e] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ══════ DASHBOARD ══════ */}
        {tab === 'dashboard' && (
          <div className="space-y-5">
            {/* Filter bar */}
            <div className="bg-white rounded-2xl border border-amber-100 shadow-sm px-5 py-3.5 flex flex-wrap gap-3 items-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Filters</span>
              <select value={selProject} onChange={e => setSelProject(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a3c5e] bg-white font-medium text-slate-700">
                <option value="">All Projects</option>
                {structure.projects.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select value={selPeriod} onChange={e => setSelPeriod(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a3c5e] bg-white font-medium text-slate-700">
                <option value="">All Periods (latest)</option>
                {periods.map(p => <option key={p} value={p}>{fmtPeriod(p)}</option>)}
              </select>
              {(selPeriod || selProject) && (
                <button onClick={() => { setSelPeriod(''); setSelProject(''); }}
                  className="text-xs font-semibold text-slate-500 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50">Clear</button>
              )}
              <span className="ml-auto text-xs text-slate-400">{dashData.length} activities · {structure.projects.length} projects</span>
            </div>

            {/* KPI summary */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Overall Progress"   value={`${overallAvg}%`}     accent="text-[#1a3c5e]" />
              <StatCard label="Activities Tracked" value={dashData.length}      accent="text-slate-800" />
              <StatCard label="Completed"          value={completedCount}       accent="text-green-600" />
              <StatCard label="In Progress"        value={inProgressCount}      accent="text-blue-600" />
            </div>

            {loading && <div className="text-center py-16 text-slate-400">Loading…</div>}

            {/* One matrix per project */}
            {structure.projects.map(project => {
              const projData = dashData.filter(r => r.project === project);
              if (projData.length === 0) return null;

              const projSubSections = [...new Set(projData.map(r => r.sub_section))].filter(Boolean).sort(bySectionOrder);
              const projComponents  = COMPONENTS.map(c => c.name).filter(n => projData.some(r => r.component === n));
              const projSections    = [...new Set(projData.map(r => r.section))].filter(Boolean).sort(bySectionOrder);

              const filled = projData.filter(r => r.pct_progress !== null);
              const projAvg = filled.length ? Math.round(filled.reduce((s,r) => s + Number(r.pct_progress), 0) / filled.length) : 0;

              function getCell(comp, sub) {
                const matches = projData.filter(r => r.component === comp && r.sub_section === sub);
                if (!matches.length) return null;
                return matches.sort((a,b) => (b.reporting_period||'') > (a.reporting_period||'') ? 1 : -1)[0];
              }

              return (
                <div key={project} className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
                  {/* Project header strip */}
                  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-[#1a3c5e] to-[#28527a]">
                    <div className="flex items-center gap-3">
                      <span className="text-white font-black text-base tracking-wide">{project}</span>
                      <span className="text-xs text-blue-100/80 font-medium">{projSections.length} sections · {projSubSections.length} sub-sections</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-blue-100/70">Overall</span>
                      <span className="text-lg font-black text-white">{projAvg}%</span>
                    </div>
                  </div>

                  {/* Section progress bars */}
                  <div className="px-5 py-4 border-b border-slate-100">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-x-5 gap-y-3">
                      {projSections.map(sec => {
                        const secRows = projData.filter(r => r.section === sec && r.pct_progress !== null);
                        const avg = secRows.length ? Math.round(secRows.reduce((s,r)=>s+Number(r.pct_progress),0)/secRows.length) : 0;
                        return (
                          <div key={sec}>
                            <div className="flex justify-between mb-1.5">
                              <span className="text-xs font-bold text-slate-600 truncate">{sec}</span>
                              <span className={`text-xs font-black ml-1 ${avg>=80?'text-green-600':avg>=50?'text-blue-600':'text-amber-600'}`}>{avg}%</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${pctBar(avg)}`} style={{width:`${avg}%`}} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Progress matrix */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider sticky left-0 bg-slate-50 min-w-[220px]">Component</th>
                          {projSubSections.map(sub => (
                            <th key={sub} className="px-2 py-3 text-center text-[11px] font-bold text-slate-500 uppercase min-w-[78px] whitespace-nowrap">{sub}</th>
                          ))}
                          <th className="px-2 py-3 text-center text-[11px] font-bold text-slate-600 uppercase min-w-[70px] bg-slate-100">Avg</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projComponents.map((comp, ci) => {
                          const cells = projSubSections.map(sub => getCell(comp, sub));
                          const filledC = cells.filter(c => c && c.pct_progress !== null);
                          const avg = filledC.length ? Math.round(filledC.reduce((s,c)=>s+Number(c.pct_progress),0)/filledC.length) : null;
                          return (
                            <tr key={comp} className={`border-b border-slate-50 ${ci%2===0?'bg-white':'bg-slate-50/40'} hover:bg-blue-50/30 transition-colors`}>
                              <td className="px-4 py-2.5 sticky left-0 bg-inherit border-r border-slate-100 text-xs font-semibold text-slate-700">{comp}</td>
                              {projSubSections.map(sub => {
                                const cell = getCell(comp, sub);
                                const pct = cell?.pct_progress;
                                return (
                                  <td key={sub} className="px-1 py-1.5 text-center">
                                    {pct === null || pct === undefined
                                      ? <span className="text-slate-200 text-xs">—</span>
                                      : <div className={`mx-1 py-1.5 rounded-lg text-xs font-black ${pctBg(pct)}`}>{Number(pct)}%</div>
                                    }
                                  </td>
                                );
                              })}
                              <td className="px-1 py-1.5 text-center bg-slate-50/60">
                                {avg !== null && <div className={`mx-1 py-1.5 rounded-lg text-xs font-black ${pctBg(avg)}`}>{avg}%</div>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {/* Legend */}
                  <div className="px-5 py-3 border-t border-slate-100 flex flex-wrap gap-2 items-center">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Legend</span>
                    {[['100%','bg-green-100 text-green-800'],['75–99%','bg-emerald-100 text-emerald-700'],['50–74%','bg-blue-100 text-blue-700'],['25–49%','bg-amber-100 text-amber-700'],['<25%','bg-red-100 text-red-700']].map(([l,c])=>(
                      <div key={l} className={`px-2 py-0.5 rounded text-[11px] font-bold ${c}`}>{l}</div>
                    ))}
                  </div>
                </div>
              );
            })}

            {!loading && dashData.length === 0 && (
              <div className="text-center py-16 text-slate-400 bg-white rounded-2xl border border-amber-100">
                No data for the selected filters. Use <strong>Enter Progress</strong> to add monthly data.
              </div>
            )}
          </div>
        )}

        {/* ══════ TREND ══════ */}
        {tab === 'trend' && (
          <div className="space-y-8">
            {structure.projects.map((project, pi) => {
              const projBase = allData.filter(r => r.project === project);
              if (!projBase.length) return null;

              const projPeriods = [...new Set(projBase.map(r => r.reporting_period))].filter(Boolean).sort();
              const projSummary = projPeriods.map(p => {
                const rows = projBase.filter(r => r.reporting_period === p && r.pct_progress !== null);
                return { period: fmtPeriod(p), avg: rows.length ? Math.round(rows.reduce((s,r)=>s+Number(r.pct_progress),0)/rows.length) : 0 };
              });
              const projTrendData = projPeriods.map(p => {
                const entry = { period: fmtPeriod(p) };
                COMPONENTS.forEach(({ name }) => {
                  const rows = projBase.filter(r => r.reporting_period === p && r.component === name && r.pct_progress !== null);
                  if (rows.length) entry[name] = Math.round(rows.reduce((s,r)=>s+Number(r.pct_progress),0)/rows.length);
                });
                return entry;
              });
              const projSections = [...new Set(projBase.map(r => r.section))].filter(Boolean).sort(bySectionOrder);
              const PROJ_COLORS = ['#1a3c5e','#2a9d8f','#e63946','#8338ec'];
              const headerColor = PROJ_COLORS[pi % PROJ_COLORS.length];

              return (
                <div key={project} className="space-y-4">
                  {/* Project header */}
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-slate-200" />
                    <span className="px-4 py-1 rounded-full text-xs font-black text-white uppercase tracking-wider" style={{background: headerColor}}>{project}</span>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>

                  {/* Bar chart */}
                  <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-5">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4">Overall Average Progress by Month</p>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={projSummary} barSize={36}>
                        <XAxis dataKey="period" tick={{fontSize:11}} />
                        <YAxis domain={[0,100]} tickFormatter={v=>`${v}%`} tick={{fontSize:11}} />
                        <Tooltip formatter={v=>[`${v}%`,'Avg Progress']} />
                        <Bar dataKey="avg" fill={headerColor} radius={[6,6,0,0]} label={{position:'top',fontSize:11,fontWeight:700,fill:headerColor}} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Line chart per component */}
                  <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-5">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4">Progress Trend per Component</p>
                    <ResponsiveContainer width="100%" height={320}>
                      <LineChart data={projTrendData} margin={{left:10,right:20,top:5,bottom:5}}>
                        <XAxis dataKey="period" tick={{fontSize:11}} />
                        <YAxis domain={[0,100]} tickFormatter={v=>`${v}%`} tick={{fontSize:11}} />
                        <Tooltip formatter={(v,name)=>[`${v}%`,name]} />
                        <Legend wrapperStyle={{fontSize:11}} />
                        {COMPONENTS.map(({name},i) => (
                          <Line key={name} type="monotone" dataKey={name} stroke={COLORS[i%COLORS.length]}
                            strokeWidth={2} dot={{r:3}} connectNulls />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Monthly snapshot table */}
                  <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-100">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Monthly Snapshot — Average by Section</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase">Section</th>
                            {projPeriods.map(p => <th key={p} className="px-4 py-3 text-center text-[11px] font-bold text-slate-500 uppercase whitespace-nowrap">{fmtPeriod(p)}</th>)}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {projSections.map(sec => (
                            <tr key={sec} className="hover:bg-slate-50">
                              <td className="px-4 py-3 font-bold text-slate-700">{sec}</td>
                              {projPeriods.map(p => {
                                const rows = projBase.filter(r => r.section === sec && r.reporting_period === p && r.pct_progress !== null);
                                const avg = rows.length ? Math.round(rows.reduce((s,r)=>s+Number(r.pct_progress),0)/rows.length) : null;
                                return (
                                  <td key={p} className="px-4 py-3 text-center">
                                    {avg === null ? <span className="text-slate-300">—</span> : (
                                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-black ${pctBg(avg)}`}>{avg}%</span>
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
                </div>
              );
            })}
          </div>
        )}

        {/* ══════ ENTER PROGRESS ══════ */}
        {tab === 'enter' && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-5">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4">Monthly Data Entry</p>
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Reporting Period *</label>
                  <input type="month" value={epPeriod ? epPeriod.slice(0,7) : ''}
                    onChange={e => setEpPeriod(e.target.value ? e.target.value + '-01' : '')}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Project</label>
                  <select value={epProject} onChange={e => setEpProject(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e] bg-white">
                    {(structure.projects.length ? structure.projects : ['LCCH']).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="text-xs text-slate-400 self-end pb-2">Enter % progress (0–100) for each component × sub-section</div>
              </div>
            </div>

            {epPeriod && (
              <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase sticky left-0 bg-slate-50 min-w-[220px]">Component</th>
                        {epSubSections.map(sub => (
                          <th key={sub} className="px-2 py-3 text-center text-[11px] font-bold text-slate-500 uppercase min-w-[72px]">{sub}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {COMPONENTS.map(({ name }, ci) => (
                        <tr key={name} className={`border-b border-slate-50 ${ci%2===0?'bg-white':'bg-slate-50/40'}`}>
                          <td className="px-4 py-2 sticky left-0 bg-inherit border-r border-slate-100 text-xs font-semibold text-slate-700">{name}</td>
                          {epSubSections.map(sub => {
                            const k = `${sub}||${name}`;
                            const val = epGrid[k] || { pct: '', remarks: '' };
                            const pct = val.pct;
                            return (
                              <td key={sub} className="px-1.5 py-1.5 text-center">
                                <input
                                  type="number" min="0" max="100"
                                  value={pct === null || pct === undefined ? '' : pct}
                                  onChange={e => setEpGrid(g => ({...g, [k]: {...(g[k]||{}), pct: e.target.value === '' ? '' : Number(e.target.value)}}))}
                                  placeholder="—"
                                  className={`w-14 text-center text-xs font-bold py-1.5 rounded-lg border focus:outline-none focus:ring-1 focus:ring-[#1a3c5e] ${pct !== '' && pct !== null && pct !== undefined ? pctBg(pct) + ' border-transparent' : 'border-slate-200 text-slate-400'}`}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-4 border-t border-slate-100 flex items-center gap-4">
                  <button onClick={saveProgress} disabled={epSaving}
                    className="px-6 py-2.5 bg-[#1a3c5e] text-white font-bold rounded-xl hover:bg-[#122d47] disabled:opacity-50 transition-colors">
                    {epSaving ? 'Saving…' : '✓ Save Progress Report'}
                  </button>
                  {epMsg && <span className={`text-sm font-semibold ${epMsg.startsWith('✓') ? 'text-green-600' : 'text-red-600'}`}>{epMsg}</span>}
                </div>
              </div>
            )}

            {!epPeriod && (
              <div className="text-center py-16 text-slate-400 bg-white rounded-2xl border border-amber-100">
                Select a reporting period above to start entering data.
              </div>
            )}
          </div>
        )}

        {/* ══════ SETTINGS ══════ */}
        {tab === 'settings' && (
          <div className="space-y-5">
            <div className="bg-gradient-to-br from-[#1a3c5e] to-[#28527a] rounded-2xl p-5 text-white shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-widest opacity-70 mb-3">Ideas to make this more efficient</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  ['Excel Upload', 'Drop a monthly report file → auto-imports all data without running scripts'],
                  ['Target vs Actual', 'Add a planned % per activity per month to compare against real progress'],
                  ['Delay Alerts', 'Flag activities where actual progress is more than 10% below target'],
                  ['PM Submission Reminders', 'Email Placide automatically on the 1st of each month to fill in progress'],
                  ['PDF Report Export', 'One-click export of the progress matrix as a PDF report for EBID-ECOWAS'],
                  ['S-Curve', 'Plot cumulative planned vs actual progress over the project lifetime'],
                ].map(([title, desc]) => (
                  <div key={title} className="bg-white/10 rounded-xl p-3.5">
                    <p className="font-bold text-sm">{title}</p>
                    <p className="text-xs opacity-80 mt-1 leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-5">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4">Add New Sub-Section</p>
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Project</label>
                  <input value={newProject} onChange={e => setNewProject(e.target.value)} placeholder="LCCH"
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm w-32 focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Section</label>
                  <input value={newSection} onChange={e => setNewSection(e.target.value)} placeholder="SECTION 10"
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm w-36 focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Sub-Section</label>
                  <input value={newSubSection} onChange={e => setNewSubSection(e.target.value)} placeholder="10A"
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm w-28 focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]" />
                </div>
                <button onClick={addSubSection}
                  className="px-4 py-2 bg-[#1a3c5e] text-white text-sm font-bold rounded-lg hover:bg-[#122d47] transition-colors">
                  + Add
                </button>
              </div>
              {settingMsg && <p className={`mt-3 text-sm font-semibold ${settingMsg.startsWith('✓') ? 'text-green-600' : 'text-red-600'}`}>{settingMsg}</p>}
            </div>

            <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-5">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4">Current Structure</p>
              <div className="space-y-4">
                {structure.projects.map((proj, pi) => {
                  const subs = (structure.subSectionsByProject[proj] || []).slice().sort(bySectionOrder);
                  const PROJ_COLORS = ['bg-[#1a3c5e]','bg-[#2a9d8f]','bg-[#e63946]','bg-[#8338ec]'];
                  const color = PROJ_COLORS[pi % PROJ_COLORS.length];
                  return (
                    <div key={proj} className="border border-slate-100 rounded-xl overflow-hidden">
                      <div className={`${color} px-4 py-2 flex items-center justify-between`}>
                        <span className="text-white text-sm font-bold">{proj}</span>
                        <span className="text-white/70 text-xs">{subs.length} sub-section{subs.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="px-4 py-3 flex flex-wrap gap-2">
                        {subs.length === 0
                          ? <span className="text-xs text-slate-400 italic">No sub-sections yet</span>
                          : subs.map(s => (
                            <span key={s} className={`px-2.5 py-1 ${color} text-white text-xs font-bold rounded-lg`}>{s}</span>
                          ))
                        }
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
