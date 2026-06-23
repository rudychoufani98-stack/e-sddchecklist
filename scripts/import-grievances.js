require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const path = require('path');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Excel serial date → YYYY-MM-DD
function excelDateToISO(serial) {
  if (!serial || isNaN(serial)) return null;
  const d = new Date(Math.round((serial - 25569) * 86400000));
  return d.toISOString().split('T')[0];
}

function cleanStr(v) {
  if (v === null || v === undefined || v === 'N/A' || v === '' || v === 'n/a') return null;
  return String(v).trim().toLowerCase().replace(/\s+/g, '_');
}

function rawStr(v) {
  if (v === null || v === undefined || v === 'N/A' || v === '') return null;
  return String(v).trim();
}

async function run() {
  const filePath = path.join('C:\\Users\\roudy\\Desktop', 'Grievancy Kobo Data.xlsx');
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws);

  console.log(`Read ${rows.length} rows from Excel`);

  // 1. Get existing projects & sub-sections
  const { data: existingProjects } = await supabase.from('grv_projects').select('*, grv_sub_sections(*)');
  const projectMap = {}; // normalised name → { id, subs: { name → id } }
  for (const p of existingProjects || []) {
    const key = p.name.toLowerCase().replace(/\s+/g, '_');
    projectMap[key] = { id: p.id, name: p.name, subs: {} };
    for (const s of p.grv_sub_sections || []) {
      projectMap[key].subs[s.name.toLowerCase().replace(/\s+/g, '_')] = s.id;
    }
  }

  async function getOrCreateProject(rawName) {
    if (!rawName) return null;
    const key = rawName.toLowerCase().replace(/\s+/g, '_');
    if (projectMap[key]) return projectMap[key].id;
    // Create
    const displayName = rawName.toUpperCase();
    const { data } = await supabase.from('grv_projects').insert({ name: displayName }).select().single();
    projectMap[key] = { id: data.id, name: displayName, subs: {} };
    console.log(`  Created project: ${displayName}`);
    return data.id;
  }

  async function getOrCreateSubSection(projectKey, rawSub, projectId) {
    if (!rawSub || !projectId) return null;
    const key = rawSub.toLowerCase().replace(/\s+/g, '_');
    if (!projectMap[projectKey]) return null;
    if (projectMap[projectKey].subs[key]) return projectMap[projectKey].subs[key];
    // Create
    const displayName = rawSub.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const { data } = await supabase.from('grv_sub_sections').insert({ name: displayName, project_id: projectId }).select().single();
    projectMap[projectKey].subs[key] = data.id;
    console.log(`  Created sub-section: ${displayName} (project ${projectId})`);
    return data.id;
  }

  // 2. Get next ref number
  const { data: lastGrv } = await supabase.from('grievances').select('reference_no').order('id', { ascending: false }).limit(1);
  let counter = 1;
  if (lastGrv && lastGrv[0]) {
    counter = parseInt(lastGrv[0].reference_no.replace('GRV-', '')) + 1;
  }

  // 3. Import rows
  let imported = 0;
  let skipped  = 0;
  const errors = [];

  for (const row of rows) {
    try {
      const projectRaw = rawStr(row['Project_Name']);
      const subRaw     = rawStr(row['Sub_Section']);
      const projectKey = (projectRaw || '').toLowerCase().replace(/\s+/g, '_');

      const projectId    = await getOrCreateProject(projectRaw);
      const subSectionId = await getOrCreateSubSection(projectKey, subRaw, projectId);

      const refNo = `GRV-${String(counter).padStart(3, '0')}`;
      counter++;

      const followUp = rawStr(row['Follow_Up_Required']);
      const followUpBool = followUp === 'yes' || followUp === 'true' || followUp === '1';

      const payload = {
        reference_no:          refNo,
        date_of_receipt:       excelDateToISO(row['Date_of_Receipt']),
        date_of_registration:  excelDateToISO(row['Date_of_Registration']),
        project_id:            projectId,
        sub_section_id:        subSectionId,
        complaint_relationship: cleanStr(row['Complaint_Relationship22']),
        community_name:        rawStr(row['Community_Name3']),
        nature_type:           cleanStr(row['Nature_Type']),
        nature_of_grievance:   rawStr(row['Nature_of_Grievance2'])?.replace(/_/g, ' '),
        issue_description:     rawStr(row['Issue_Description']),
        risk_significance:     cleanStr(row['Risk_Significance']) || 'low',
        priority_level:        cleanStr(row['Priority_Level']) || 'low',
        proposed_resolution:   rawStr(row['Proposed_Resolution']),
        deadline:              excelDateToISO(row['Deadline']),
        status:                cleanStr(row['Status']) || 'open',
        date_of_acknowledgment: excelDateToISO(row['Date_of_Acknowledgment']),
        escalation_level:      cleanStr(row['Escalation_Level2']) || 'level_1_site_team',
        follow_up_required:    followUpBool,
        next_follow_up_date:   excelDateToISO(row['Next_follow_up_Date']),
        pdca:                  cleanStr(row['PDCA']),
        lesson_learned:        rawStr(row['Lesson_Learned_Systemic_Flag']),
        submitted_by:          'kobo-import',
      };

      const { error } = await supabase.from('grievances').insert(payload);
      if (error) { errors.push({ ref: refNo, error: error.message }); skipped++; }
      else imported++;

    } catch (err) {
      errors.push({ row: JSON.stringify(row).slice(0, 80), error: err.message });
      skipped++;
    }
  }

  console.log(`\nDone: ${imported} imported, ${skipped} skipped`);
  if (errors.length) { console.log('Errors:'); errors.forEach(e => console.log(' -', e)); }
}

run().catch(console.error);
