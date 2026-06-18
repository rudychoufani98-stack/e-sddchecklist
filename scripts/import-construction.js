require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Excel serial → YYYY-MM-DD
function serialToISO(v) {
  if (!v || v === '') return null;
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return d.toISOString().split('T')[0];
  }
  // Already a string like "02/2026" or "03/2026"
  if (typeof v === 'string' && v.match(/^\d{2}\/\d{4}$/)) {
    const [mm, yyyy] = v.split('/');
    return `${yyyy}-${mm}-01`;
  }
  return null;
}

// Sub-section → section mapping
function subToSection(sub) {
  if (['1A','1B','1C'].includes(sub)) return 'SECTION 1';
  if (sub === '2')                    return 'SECTION 2';
  if (['3A','3B'].includes(sub))      return 'SECTION 3';
  if (['4A','4B'].includes(sub))      return 'SECTION 4';
  const num = parseInt(sub);
  if (!isNaN(num) && num >= 5 && num <= 9) return `SECTION ${num}`;
  return sub;
}

const SUB_SECTIONS = ['1A','1B','1C','2','3A','3B','4A','4B','5','6','7','8','9'];

const FILES = [
  {
    path: 'C:\\Users\\roudy\\Desktop\\Hitech\\Dashboards\\X Dashboard Montly Progress\\LCCH\\LCCH_022026.xlsx',
    sheet: '022026', period: '2026-02-01',
  },
  {
    path: 'C:\\Users\\roudy\\Desktop\\Hitech\\Dashboards\\X Dashboard Montly Progress\\LCCH\\LCCH_032026.xlsx',
    sheet: '032026', period: null, // read from cell
  },
  {
    path: 'C:\\Users\\roudy\\Desktop\\Hitech\\Dashboards\\X Dashboard Montly Progress\\LCCH\\LCCH_042026.xlsx',
    sheet: '042026', period: '2026-04-01',
  },
  {
    path: 'C:\\Users\\roudy\\Desktop\\Hitech\\Dashboards\\X Dashboard Montly Progress\\LCCH\\LCCH_052026.xlsx',
    sheet: '052026', period: '2026-05-01',
  },
  {
    path: 'C:\\Users\\roudy\\Desktop\\LCCH SEC 2 Section_JUNE 2026.xlsx',
    sheet: null, // use PBI sheet fallback
    period: '2026-06-01',
  },
];

async function parseFile({ path, sheet, period }) {
  const wb = XLSX.readFile(path);
  const records = [];

  // For June file, use PBI sheet since it only has Sec 2 data
  if (!sheet) {
    const pbiSheet = wb.SheetNames.find(s => s.startsWith('PBI'));
    if (!pbiSheet) return [];
    const ws = wb.Sheets[pbiSheet];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    for (const r of rows) {
      const pct = r['Pct_Progress'];
      if (pct === '' || pct === null || pct === undefined) continue;
      const sub = String(r['Sub_Section'] || '').replace(/"/g,'').trim();
      records.push({
        reporting_period: period,
        project: 'LCCH',
        section: subToSection(sub),
        sub_section: sub,
        component: String(r['Component'] || '').trim(),
        key_activities: String(r['Key_Activities'] || '').trim(),
        pct_progress: parseFloat(pct) || 0,
        remarks: String(r['Remarks'] || '').trim() || null,
        prepared_by: 'import',
        status: parseFloat(pct) >= 100 ? 'Completed' : parseFloat(pct) > 0 ? 'In Progress' : 'Not Started',
      });
    }
    return records;
  }

  const ws = wb.Sheets[sheet];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // Detect period from cell B4 (row index 3)
  const reportingPeriod = period || serialToISO(rows[3]?.[1]) || '2026-01-01';

  // Row 7 (index 7) = section headers, row 8 (index 8) = sub-section headers
  // Rows 9-18 (index 9-18) = component data
  // Columns: 0=#, 1=Component, 2=Key Activities, 3..15=sub-sections, 16=Remarks

  const dataRows = rows.slice(9, 19).filter(r => r[1] && r[1] !== 'Project Delivery Overview');

  for (const row of dataRows) {
    const component = String(row[1] || '').trim();
    const keyActs   = String(row[2] || '').trim();
    const remarks   = String(row[16] || '').trim() || null;
    if (!component) continue;

    SUB_SECTIONS.forEach((sub, colIdx) => {
      const pct = row[colIdx + 3]; // cols 3..15
      if (pct === '' || pct === null || pct === undefined) return;
      const pctNum = parseFloat(pct);
      if (isNaN(pctNum)) return;
      records.push({
        reporting_period: reportingPeriod,
        project: 'LCCH',
        section: subToSection(sub),
        sub_section: sub,
        component,
        key_activities: keyActs,
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
  // Clear all existing construction progress data
  await supabase.from('construction_progress').delete().neq('id', 0);
  console.log('Cleared existing data.');

  let totalInserted = 0;

  for (const file of FILES) {
    console.log(`\nProcessing: ${file.path.split('\\').pop()}`);
    const records = await parseFile(file);
    console.log(`  Parsed ${records.length} records`);
    if (records.length === 0) { console.log('  (skipped — no data)'); continue; }

    const { error } = await supabase.from('construction_progress').insert(records);
    if (error) { console.error('  Insert error:', error.message); continue; }
    console.log(`  Inserted ${records.length} records for period ${file.period || 'auto'}`);
    totalInserted += records.length;
  }

  console.log(`\nDone. Total inserted: ${totalInserted}`);
}

run().catch(console.error);
