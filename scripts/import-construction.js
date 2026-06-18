require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

function serialToISO(v) {
  if (!v || v === '') return null;
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return d.toISOString().split('T')[0];
  }
  if (typeof v === 'string' && v.match(/^\d{2}\/\d{4}$/)) {
    const [mm, yyyy] = v.split('/');
    return `${yyyy}-${mm}-01`;
  }
  return null;
}

// LCCH sub-section → section
function lcchSubToSection(sub) {
  if (['1A','1B','1C'].includes(sub)) return 'SECTION 1';
  if (sub === '2')                    return 'SECTION 2';
  if (['3A','3B'].includes(sub))      return 'SECTION 3';
  if (['4A','4B'].includes(sub))      return 'SECTION 4';
  const num = parseInt(sub);
  if (!isNaN(num) && num >= 5 && num <= 9) return `SECTION ${num}`;
  return sub;
}

const LCCH_SUB_SECTIONS = ['1A','1B','1C','2','3A','3B','4A','4B','5','6','7','8','9'];

const FILES = [
  // LCCH
  { path: 'C:\\Users\\roudy\\Desktop\\Hitech\\Dashboards\\X Dashboard Montly Progress\\LCCH\\LCCH_022026.xlsx', project: 'LCCH', sheet: '022026', period: '2026-02-01' },
  { path: 'C:\\Users\\roudy\\Desktop\\Hitech\\Dashboards\\X Dashboard Montly Progress\\LCCH\\LCCH_032026.xlsx', project: 'LCCH', sheet: '032026', period: null },
  { path: 'C:\\Users\\roudy\\Desktop\\Hitech\\Dashboards\\X Dashboard Montly Progress\\LCCH\\LCCH_042026.xlsx', project: 'LCCH', sheet: '042026', period: '2026-04-01' },
  { path: 'C:\\Users\\roudy\\Desktop\\Hitech\\Dashboards\\X Dashboard Montly Progress\\LCCH\\LCCH_052026.xlsx', project: 'LCCH', sheet: '052026', period: '2026-05-01' },
  { path: 'C:\\Users\\roudy\\Desktop\\LCCH SEC 2 Section_JUNE 2026.xlsx',                                       project: 'LCCH', sheet: null,     period: '2026-06-01', lcchSec2: true },
  // SBS (Sokoto Badagry Superhighway)
  { path: 'C:\\Users\\roudy\\Desktop\\Hitech\\Dashboards\\X Dashboard Montly Progress\\Sokoto\\Sokoto_022026.xlsx', project: 'SBS', sheet: null, period: '2026-02-01', sbs: true },
  { path: 'C:\\Users\\roudy\\Desktop\\Hitech\\Dashboards\\X Dashboard Montly Progress\\Sokoto\\Sokoto_032026.xlsx', project: 'SBS', sheet: null, period: '2026-03-01', sbs: true },
  { path: 'C:\\Users\\roudy\\Desktop\\Hitech\\Dashboards\\X Dashboard Montly Progress\\Sokoto\\Sokoto_042026.xlsx', project: 'SBS', sheet: null, period: '2026-04-01', sbs: true },
  { path: 'C:\\Users\\roudy\\Desktop\\Hitech\\Dashboards\\X Dashboard Montly Progress\\Sokoto\\Sokoto_052026.xlsx', project: 'SBS', sheet: null, period: null,         sbs: true },
];

function parseSBSOverview(wb, period) {
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // Auto-detect period from row 3 col 1
  const reportingPeriod = period || serialToISO(rows[3]?.[1]) || '2026-01-01';

  // Row 7 (index 7): col headers — sub-section names like "Sokoto Section 1A", "Kebbi section 2A"
  // Row 8 (index 8): (%) labels
  // Rows 9–17 (index 9–17): data
  const colHeaders = rows[7] || [];

  // Parse sub-sections from column headers (cols 3 onward)
  const subSections = [];
  for (let c = 3; c < colHeaders.length; c++) {
    const h = String(colHeaders[c] || '').trim();
    if (!h || h === 'Remarks') break;
    // Extract sub-section code and section from header
    // e.g. "Sokoto Section 1A" → sub: "1A", section: "SOKOTO SECTION 1"
    // e.g. "Kebbi section 2A"  → sub: "2A", section: "KEBBI SECTION 2"
    const match = h.match(/^(\w+)\s+[Ss]ection\s+(\w+)$/i);
    if (match) {
      const area = match[1].toUpperCase(); // SOKOTO or KEBBI
      const code = match[2].toUpperCase(); // 1A, 1B, 2A, 2B
      const sectionNum = code.replace(/[A-Z]/g,'');
      subSections.push({ col: c, sub: `${area.slice(0,3)}-${code}`, section: `${area} SECTION ${sectionNum}`, label: h });
    } else {
      subSections.push({ col: c, sub: h, section: h, label: h });
    }
  }

  const records = [];
  const dataRows = rows.slice(9, 19).filter(r => r[1] && r[1] !== 'Project Delivery Overview');

  for (const row of dataRows) {
    const component    = String(row[1] || '').trim();
    const keyActivities = String(row[2] || '').trim();
    if (!component) continue;

    for (const { col, sub, section } of subSections) {
      const pct = row[col];
      if (pct === '' || pct === null || pct === undefined) continue;
      const pctNum = parseFloat(pct);
      if (isNaN(pctNum)) continue;
      records.push({
        reporting_period: reportingPeriod,
        project: 'SBS',
        section,
        sub_section: sub,
        component,
        key_activities: keyActivities,
        pct_progress: pctNum,
        remarks: null,
        prepared_by: 'import',
        status: pctNum >= 100 ? 'Completed' : pctNum > 0 ? 'In Progress' : 'Not Started',
      });
    }
  }
  return records;
}

function parseLCCHOverview(wb, period) {
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const dataRows = rows.slice(9, 19).filter(r => r[1] && typeof r[3] === 'number');
  return dataRows.map(row => ({
    reporting_period: period,
    project: 'LCCH',
    section: 'SECTION 2',
    sub_section: '2',
    component: String(row[1]).trim(),
    key_activities: String(row[2]).trim(),
    pct_progress: parseFloat(row[3]),
    remarks: null,
    prepared_by: 'import',
    status: parseFloat(row[3]) >= 100 ? 'Completed' : parseFloat(row[3]) > 0 ? 'In Progress' : 'Not Started',
  }));
}

function parseLCCHStructured(wb, sheet, period) {
  const ws = wb.Sheets[sheet];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const reportingPeriod = period || serialToISO(rows[3]?.[1]) || '2026-01-01';
  const records = [];

  const dataRows = rows.slice(9, 19).filter(r => r[1] && r[1] !== 'Project Delivery Overview');
  for (const row of dataRows) {
    const component    = String(row[1] || '').trim();
    const keyActivities = String(row[2] || '').trim();
    const remarks      = String(row[16] || '').trim() || null;
    if (!component) continue;

    LCCH_SUB_SECTIONS.forEach((sub, i) => {
      const pct = row[i + 3];
      if (pct === '' || pct === null || pct === undefined) return;
      const pctNum = parseFloat(pct);
      if (isNaN(pctNum)) return;
      records.push({
        reporting_period: reportingPeriod,
        project: 'LCCH',
        section: lcchSubToSection(sub),
        sub_section: sub,
        component,
        key_activities: keyActivities,
        pct_progress: pctNum,
        remarks,
        prepared_by: 'import',
        status: pctNum >= 100 ? 'Completed' : pctNum > 0 ? 'In Progress' : 'Not Started',
      });
    });
  }
  return records;
}

async function run() {
  await supabase.from('construction_progress').delete().neq('id', 0);
  console.log('Cleared existing data.\n');

  let total = 0;

  for (const file of FILES) {
    const label = file.path.split('\\').pop();
    console.log(`Processing: ${label}`);
    const wb = XLSX.readFile(file.path);
    let records = [];

    if (file.sbs)      records = parseSBSOverview(wb, file.period);
    else if (file.lcchSec2) records = parseLCCHOverview(wb, file.period);
    else               records = parseLCCHStructured(wb, file.sheet, file.period);

    if (records.length === 0) { console.log('  (no data — skipped)\n'); continue; }

    const { error } = await supabase.from('construction_progress').insert(records);
    if (error) { console.error('  Error:', error.message); continue; }
    console.log(`  ✓ ${records.length} records  [${file.project} | ${records[0]?.reporting_period}]\n`);
    total += records.length;
  }

  console.log(`Done. Total: ${total} records`);
}

run().catch(console.error);
