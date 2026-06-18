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
  if (v === null || v === undefined || v === '') return 'bg-gray-100 text-gray-400';
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

export default function ConstructionProgress() {
  const [tab, setTab]             = useState('dashboard');
  const [allData, setAllData]     = useState([]);
  const [periods, setPeriods]     = useState([]);
  const [structure, setStructure] = useState({ projects: [], sections: [], subSections: [], components: [], componentMap: {} });
  const [loading, setLoading]     = useState(true);

  // Dashboard filters
  const [selPeriod,  setSelPeriod]  = useState('');
  const [selProject, setSelProject] = useState('');
  const [selSection, setSelSection] = useState('');

  // Enter Progress state
  const [epPeriod,   setEpPeriod]   = useState('');
  const [epProject,  setEpProject]  = useState('LCCH');
  const [epGrid,     setEpGrid]     = useState({}); // key: `${sub}||${comp}` → {pct, remarks}
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
      if (!selPeriod && rPeriods.data.length) setSelPeriod(rPeriods.data[0]);
    } catch {}
    setLoading(false);
  }, []); // eslint-disable-line

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

  // Derived data for dashboard
  const dashData = allData.filter(r =>
    (!selPeriod  || r.reporting_period === selPeriod) &&
    (!selProject || r.project === selProject) &&
    (!selSection || r.section === selSection)
  );

  const dashSections   = [...new Set(dashData.map(r => r.section))].filter(Boolean).sort();
  const dashSubSections = [...new Set(dashData.map(r => r.sub_section))].filter(Boolean).sort((a,b)=>{
    const order = ['1A','1B','1C','2','3A','3B','4A','4B','5','6','7','8','9'];
    return order.indexOf(a) - order.indexOf(b);
  });
  const dashComponents = COMPONENTS.map(c => c.name).filter(n => dashData.some(r => r.component === n));

  function getCell(comp, sub) {
    return dashData.find(r => r.component === comp && r.sub_section === sub);
  }

  // Trend data — avg per component per period
  const trendPeriods = [...periods].sort();
  const trendData = trendPeriods.map(p => {
    const entry = { period: fmtPeriod(p) };
    COMPONENTS.forEach(({ name }) => {
      const rows = allData.filter(r => r.reporting_period === p && r.component === name && r.pct_progress !== null);
      if (rows.length) entry[name] = Math.round(rows.reduce((s,r) => s + Number(r.pct_progress), 0) / rows.length);
    });
    return entry;
  });

  // Overall avg per period for summary bar
  const periodSummary = trendPeriods.map(p => {
    const rows = allData.filter(r => r.reporting_period === p && r.pct_progress !== null);
    return { period: fmtPeriod(p), avg: rows.length ? Math.round(rows.reduce((s,r) => s + Number(r.pct_progress), 0) / rows.length) : 0 };
  });

  // Enter Progress: active sub-sections for selected project
  const epSubSections = structure.subSections.length ? structure.subSections : ['1A','1B','1C','2','3A','3B','4A','4B','5','6','7','8','9'];

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
    { key: 'dashboard', label: '📊 Dashboard' },
    { key: 'trend',     label: '📈 Trend' },
    { key: 'enter',     label: '✏️ Enter Progress' },
    { key: 'settings',  label: '⚙️ Settings' },
  ];

  return (
    <div className="min-h-screen bg-[#f0f4f8]">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-[#1a3c5e]">Construction Progress</h1>
            <p className="text-sm text-gray-400">LCCH — Monthly reporting dashboard</p>
          </div>
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === t.key ? 'bg-white text-[#1a3c5e] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ══════ DASHBOARD ══════ */}
        {tab === 'dashboard' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-3 flex flex-wrap gap-3 items-center">
              <select value={selPeriod} onChange={e => setSelPeriod(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a3c5e] bg-white font-semibold">
                <option value="">All Periods</option>
                {periods.map(p => <option key={p} value={p}>{fmtPeriod(p)}</option>)}
              </select>
              <select value={selProject} onChange={e => setSelProject(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a3c5e] bg-white">
                <option value="">All Projects</option>
                {structure.projects.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select value={selSection} onChange={e => setSelSection(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a3c5e] bg-white">
                <option value="">All Sections</option>
                {structure.sections.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {(selPeriod || selProject || selSection) && (
                <button onClick={() => { setSelPeriod(''); setSelProject(''); setSelSection(''); }}
                  className="text-xs font-semibold text-red-500 border border-red-200 rounded-lg px-3 py-2 hover:bg-red-50">Clear</button>
              )}
              <span className="ml-auto text-xs text-gray-400">{dashData.length} activities</span>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Overall Progress', value: `${dashData.length ? Math.round(dashData.filter(r=>r.pct_progress!==null).reduce((s,r)=>s+Number(r.pct_progress),0)/dashData.filter(r=>r.pct_progress!==null).length||0) : 0}%`, color: 'text-[#1a3c5e]' },
                { label: 'Activities Tracked', value: dashData.length, color: 'text-[#1a3c5e]' },
                { label: 'Completed (100%)', value: dashData.filter(r=>Number(r.pct_progress)>=100).length, color: 'text-green-600' },
                { label: 'In Progress', value: dashData.filter(r=>Number(r.pct_progress)>0&&Number(r.pct_progress)<100).length, color: 'text-blue-600' },
              ].map(k => (
                <div key={k.label} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{k.label}</p>
                  <p className={`text-4xl font-black ${k.color}`}>{k.value}</p>
                </div>
              ))}
            </div>

            {/* Section summary bars */}
            {dashSections.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Progress by Section</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {dashSections.map(sec => {
                    const secRows = dashData.filter(r => r.section === sec && r.pct_progress !== null);
                    const avg = secRows.length ? Math.round(secRows.reduce((s,r)=>s+Number(r.pct_progress),0)/secRows.length) : 0;
                    return (
                      <div key={sec}>
                        <div className="flex justify-between mb-1.5">
                          <span className="text-sm font-bold text-gray-800">{sec}</span>
                          <span className={`text-sm font-black ${avg>=80?'text-green-600':avg>=50?'text-blue-600':'text-amber-600'}`}>{avg}%</span>
                        </div>
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${pctBar(avg)}`} style={{width:`${avg}%`}} />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{secRows.length} activities · {selPeriod ? fmtPeriod(selPeriod) : 'all periods'}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Heat matrix: Components × Sub-sections */}
            {dashData.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Progress Matrix — Component × Sub-section</p>
                  <p className="text-xs text-gray-400 mt-0.5">Color = progress level · Click a cell to see details</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-[#1a3c5e] text-white">
                        <th className="px-4 py-3 text-left text-xs font-bold sticky left-0 bg-[#1a3c5e] min-w-[240px]">Component</th>
                        {dashSubSections.map(sub => (
                          <th key={sub} className="px-3 py-3 text-center text-xs font-bold min-w-[70px] whitespace-nowrap">{sub}</th>
                        ))}
                        <th className="px-3 py-3 text-center text-xs font-bold min-w-[70px]">Avg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashComponents.map((comp, ci) => {
                        const compCells = dashSubSections.map(sub => getCell(comp, sub));
                        const filled = compCells.filter(c => c && c.pct_progress !== null);
                        const avg = filled.length ? Math.round(filled.reduce((s,c)=>s+Number(c.pct_progress),0)/filled.length) : null;
                        return (
                          <tr key={comp} className={ci%2===0?'bg-white':'bg-gray-50/50'}>
                            <td className="px-4 py-2.5 sticky left-0 bg-inherit border-r border-gray-100">
                              <div className="font-semibold text-gray-800 text-xs leading-tight">{comp}</div>
                            </td>
                            {dashSubSections.map(sub => {
                              const cell = getCell(comp, sub);
                              const pct = cell?.pct_progress;
                              return (
                                <td key={sub} className="px-1 py-1 text-center">
                                  {pct === null || pct === undefined ? (
                                    <span className="text-gray-200 text-xs">—</span>
                                  ) : (
                                    <div className={`mx-1 py-1.5 rounded-lg text-xs font-black ${pctBg(pct)}`}>
                                      {Number(pct)}%
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                            <td className="px-1 py-1 text-center">
                              {avg !== null && (
                                <div className={`mx-1 py-1.5 rounded-lg text-xs font-black border ${pctBg(avg)}`}>{avg}%</div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {/* Legend */}
                <div className="px-5 py-3 border-t border-gray-100 flex flex-wrap gap-3">
                  {[['≥100%','bg-green-100 text-green-800'],['≥75%','bg-emerald-100 text-emerald-700'],['≥50%','bg-blue-100 text-blue-700'],['≥25%','bg-amber-100 text-amber-700'],['<25%','bg-red-100 text-red-700']].map(([l,c])=>(
                    <div key={l} className="flex items-center gap-1.5">
                      <div className={`w-8 h-4 rounded text-xs flex items-center justify-center font-bold ${c}`}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {loading && <div className="text-center py-16 text-gray-400">Loading…</div>}
            {!loading && dashData.length === 0 && (
              <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">
                No data for selected filters. Use <strong>Enter Progress</strong> to add monthly data.
              </div>
            )}
          </div>
        )}

        {/* ══════ TREND ══════ */}
        {tab === 'trend' && (
          <div className="space-y-4">
            {/* Period summary */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Overall Average Progress by Month</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={periodSummary} barSize={40}>
                  <XAxis dataKey="period" tick={{fontSize:11}} />
                  <YAxis domain={[0,100]} tickFormatter={v=>`${v}%`} tick={{fontSize:11}} />
                  <Tooltip formatter={v=>[`${v}%`,'Avg Progress']} />
                  <Bar dataKey="avg" fill="#1a3c5e" radius={[6,6,0,0]} label={{position:'top',fontSize:11,fontWeight:700}} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Component trend lines */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Progress Trend per Component</p>
              <ResponsiveContainer width="100%" height={380}>
                <LineChart data={trendData} margin={{left:10,right:20,top:5,bottom:5}}>
                  <XAxis dataKey="period" tick={{fontSize:11}} />
                  <YAxis domain={[0,100]} tickFormatter={v=>`${v}%`} tick={{fontSize:11}} />
                  <Tooltip formatter={(v,name)=>[`${v}%`,name]} />
                  <Legend wrapperStyle={{fontSize:11}} />
                  {COMPONENTS.map(({name},i) => (
                    <Line key={name} type="monotone" dataKey={name} stroke={COLORS[i%COLORS.length]}
                      strokeWidth={2} dot={{r:4}} connectNulls />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Section trend table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Monthly Snapshot — Average by Section</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Section</th>
                      {trendPeriods.map(p => <th key={p} className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase whitespace-nowrap">{fmtPeriod(p)}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {structure.sections.map(sec => (
                      <tr key={sec} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-bold text-[#1a3c5e]">{sec}</td>
                        {trendPeriods.map(p => {
                          const rows = allData.filter(r => r.section === sec && r.reporting_period === p && r.pct_progress !== null);
                          const avg = rows.length ? Math.round(rows.reduce((s,r)=>s+Number(r.pct_progress),0)/rows.length) : null;
                          return (
                            <td key={p} className="px-4 py-3 text-center">
                              {avg === null ? <span className="text-gray-300">—</span> : (
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
        )}

        {/* ══════ ENTER PROGRESS ══════ */}
        {tab === 'enter' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Monthly Data Entry</p>
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Reporting Period *</label>
                  <input type="month" value={epPeriod ? epPeriod.slice(0,7) : ''}
                    onChange={e => setEpPeriod(e.target.value ? e.target.value + '-01' : '')}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Project</label>
                  <select value={epProject} onChange={e => setEpProject(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e] bg-white">
                    {(structure.projects.length ? structure.projects : ['LCCH']).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="text-xs text-gray-400 self-end pb-2">Enter % progress (0–100) for each component × sub-section</div>
              </div>
            </div>

            {epPeriod && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-[#1a3c5e] text-white">
                        <th className="px-4 py-3 text-left text-xs font-bold sticky left-0 bg-[#1a3c5e] min-w-[220px]">Component</th>
                        {epSubSections.map(sub => (
                          <th key={sub} className="px-2 py-3 text-center text-xs font-bold min-w-[72px]">{sub}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {COMPONENTS.map(({ name }, ci) => (
                        <tr key={name} className={ci%2===0?'bg-white':'bg-gray-50/50'}>
                          <td className="px-4 py-2 sticky left-0 bg-inherit border-r border-gray-100 text-xs font-semibold text-gray-700">{name}</td>
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
                                  className={`w-14 text-center text-xs font-bold py-1.5 rounded-lg border focus:outline-none focus:ring-1 focus:ring-[#1a3c5e] ${pct !== '' && pct !== null && pct !== undefined ? pctBg(pct) + ' border-transparent' : 'border-gray-200 text-gray-400'}`}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-4 border-t border-gray-100 flex items-center gap-4">
                  <button onClick={saveProgress} disabled={epSaving}
                    className="px-6 py-2.5 bg-[#1a3c5e] text-white font-bold rounded-xl hover:bg-[#122d47] disabled:opacity-50 transition-colors">
                    {epSaving ? 'Saving…' : '✓ Save Progress Report'}
                  </button>
                  {epMsg && <span className={`text-sm font-semibold ${epMsg.startsWith('✓') ? 'text-green-600' : 'text-red-600'}`}>{epMsg}</span>}
                </div>
              </div>
            )}

            {!epPeriod && (
              <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">
                Select a reporting period above to start entering data.
              </div>
            )}
          </div>
        )}

        {/* ══════ SETTINGS ══════ */}
        {tab === 'settings' && (
          <div className="space-y-4">
            {/* Ideas panel */}
            <div className="bg-gradient-to-br from-[#1a3c5e] to-[#2a5c8e] rounded-2xl p-5 text-white">
              <p className="text-xs font-bold uppercase tracking-widest opacity-70 mb-3">💡 Ideas to make this more efficient</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  ['📎 Excel Upload', 'Drop a monthly report file → auto-imports all data without running scripts'],
                  ['🎯 Target vs Actual', 'Add a planned % per activity per month to compare against real progress'],
                  ['🔴 Delay Alerts', 'Flag activities where actual progress is more than 10% below target'],
                  ['📧 PM Submission Reminders', 'Email Placide automatically on the 1st of each month to fill in progress'],
                  ['📄 PDF Report Export', 'One-click export of the progress matrix as a PDF report for EBID-ECOWAS'],
                  ['📐 S-Curve', 'Plot cumulative planned vs actual progress over the project lifetime'],
                ].map(([title, desc]) => (
                  <div key={title} className="bg-white/10 rounded-xl p-3">
                    <p className="font-bold text-sm">{title}</p>
                    <p className="text-xs opacity-80 mt-1">{desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Add sub-section */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Add New Sub-Section</p>
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Project</label>
                  <input value={newProject} onChange={e => setNewProject(e.target.value)} placeholder="LCCH"
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-32 focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Section</label>
                  <input value={newSection} onChange={e => setNewSection(e.target.value)} placeholder="SECTION 10"
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-36 focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Sub-Section</label>
                  <input value={newSubSection} onChange={e => setNewSubSection(e.target.value)} placeholder="10A"
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-28 focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]" />
                </div>
                <button onClick={addSubSection}
                  className="px-4 py-2 bg-[#1a3c5e] text-white text-sm font-bold rounded-lg hover:bg-[#122d47] transition-colors">
                  + Add
                </button>
              </div>
              {settingMsg && <p className={`mt-3 text-sm font-semibold ${settingMsg.startsWith('✓') ? 'text-green-600' : 'text-red-600'}`}>{settingMsg}</p>}
            </div>

            {/* Current structure */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Current Structure</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm font-bold text-gray-700 mb-2">Projects</p>
                  {structure.projects.map(p => <div key={p} className="text-sm text-gray-600 py-1 border-b border-gray-50">{p}</div>)}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-700 mb-2">Sections</p>
                  {structure.sections.map(s => <div key={s} className="text-sm text-gray-600 py-1 border-b border-gray-50">{s}</div>)}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-700 mb-2">Sub-Sections</p>
                  <div className="flex flex-wrap gap-2">
                    {structure.subSections.map(s => (
                      <span key={s} className="px-2 py-1 bg-[#1a3c5e] text-white text-xs font-bold rounded-lg">{s}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
