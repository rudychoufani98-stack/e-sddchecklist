require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const path = require('path');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

function excelDateToISO(serial) {
  if (!serial || isNaN(serial)) return null;
  const d = new Date(Math.round((serial - 25569) * 86400000));
  return d.toISOString().split('T')[0];
}

async function run() {
  const filePath = path.join('C:\\Users\\roudy\\Desktop', 'LCCH SEC 2 Section_JUNE 2026.xlsx');
  const wb = XLSX.readFile(filePath);

  // Use the PBI sheet which has structured data
  const ws = wb.Sheets['PBI_032026'];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

  console.log(`Read ${rows.length} rows from PBI_032026`);

  // Clear existing data for this reporting period
  const reportingDate = excelDateToISO(46174); // March 2026
  await supabase.from('construction_progress').delete().eq('reporting_period', reportingDate);

  const records = rows
    .filter(r => r['Pct_Progress'] !== '' && r['Pct_Progress'] !== null)
    .map(r => ({
      reporting_period: excelDateToISO(r['Reporting_Period']) || reportingDate,
      project:          String(r['Project'] || '').replace(/"/g, '').trim(),
      section:          String(r['Section'] || '').replace(/"/g, '').trim(),
      sub_section:      String(r['Sub_Section'] || '').replace(/"/g, '').trim(),
      component:        String(r['Component'] || '').trim(),
      key_activities:   String(r['Key_Activities'] || '').trim(),
      pct_progress:     parseFloat(r['Pct_Progress']) || 0,
      remarks:          String(r['Remarks'] || '').trim() || null,
      prepared_by:      'kobo-import',
      status:           parseFloat(r['Pct_Progress']) >= 100 ? 'Completed'
                        : parseFloat(r['Pct_Progress']) > 0   ? 'In Progress'
                        : 'Not Started',
    }));

  console.log(`Inserting ${records.length} records...`);
  const { error } = await supabase.from('construction_progress').insert(records);
  if (error) { console.error('Insert error:', error.message); process.exit(1); }
  console.log('Done.');
}

run().catch(console.error);
