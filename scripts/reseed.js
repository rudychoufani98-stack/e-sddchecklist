require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const commonDeliverables = [
  'E&S Impact Assessment',
  'Stakeholder Engagement Plan',
  'Stakeholder Engagement Plan Framework',
  'Human Rights Impact Assessment',
  'Human Rights Risk Assessment',
  'Environmental and Social Management System Guidance Note',
  'Commitment to Sustainability Policy',
  'Human Rights and Security Manual',
  'Environmental and Social Management System Framework',
  'Code of Conduct',
  'Dust Management Plan',
  'Environmental Construction Method Statement',
  'Soil And Water & Construction Contaminated Land Management Plan',
  'Waste Management Plan',
  'Wastewater Management Plan',
  'Biodiversity Management Plan',
  'Site Rehabilitation And Restoration Management Plan',
  'Occupational Health And Safety Management Plan',
  'Community Health And Safety Management Plan',
  'Security Management Plan',
  'Supplier And Contractor Management Plan',
  'Human Resources Management Plan',
  'Influx Management Plan',
  'Cultural Heritage Management Plan',
  'VGN / SEA / SH Action Plan',
  'Climate Change Risk Assessment',
  'Hitech Strategic Environmental & Social Objectives',
  'Resettlement Action Plan',
  'Livelihood Restoration Plan',
];

const docTypes = ['AWARD LETTER', 'BEME', 'CONTRACT', 'DESIGN FILE', 'KMZ'];

const lcch3Deliverables = [
  { number: 0,  title: 'ESG Compliance Roadmap', status: 'Ongoing', delivery_date: '22/05/26', comments: null },
  { number: 1,  title: 'Stakeholder Engagement Plan', status: 'Ongoing', delivery_date: '22/05/26', comments: 'Under review' },
  { number: 2,  title: 'Stakeholder Engagement Plan Framework', status: 'No', delivery_date: null, comments: null },
  { number: 3,  title: 'Human Rights Impact Screening', status: 'Ongoing', delivery_date: '22/05/26', comments: 'Under review' },
  { number: 4,  title: 'Human Rights Risk Assessment', status: 'No', delivery_date: null, comments: null },
  { number: 5,  title: 'Environmental and Social Management System Guidance Note', status: 'No', delivery_date: null, comments: null },
  { number: 6,  title: 'Commitment to Sustainability Policy', status: 'Yes', delivery_date: null, comments: null },
  { number: 7,  title: 'Human Rights and Security Manual', status: 'Yes', delivery_date: null, comments: null },
  { number: 8,  title: 'Environmental and Social Management System Framework', status: 'Yes', delivery_date: null, comments: null },
  { number: 9,  title: 'Code of Conduct', status: 'Yes', delivery_date: null, comments: null },
  { number: 10, title: 'Dust Management Plan', status: 'Ongoing', delivery_date: '22/05/26', comments: null },
  { number: 11, title: 'Environmental Construction Method Statement', status: 'Yes', delivery_date: null, comments: null },
  { number: 12, title: 'Soil And Water & Construction Contaminated Land Management Plan', status: 'Ongoing', delivery_date: '22/05/26', comments: null },
  { number: 13, title: 'Waste Management Plan', status: 'Ongoing', delivery_date: '22/05/26', comments: null },
  { number: 14, title: 'Wastewater Management Plan', status: 'Ongoing', delivery_date: '22/05/26', comments: null },
  { number: 15, title: 'Biodiversity Management Plan', status: 'Ongoing', delivery_date: '22/05/26', comments: null },
  { number: 16, title: 'Site Rehabilitation And Restoration Management Plan', status: 'Ongoing', delivery_date: '22/05/26', comments: null },
  { number: 17, title: 'Occupational Health And Safety Management Plan', status: 'Ongoing', delivery_date: '22/05/26', comments: null },
  { number: 18, title: 'Community Health And Safety Management Plan', status: 'Ongoing', delivery_date: '22/05/26', comments: null },
  { number: 19, title: 'Security Management Plan', status: 'Ongoing', delivery_date: '22/05/26', comments: null },
  { number: 20, title: 'Supplier And Contractor Management Plan', status: 'Ongoing', delivery_date: '22/05/26', comments: null },
  { number: 21, title: 'Human Resources Management Plan', status: 'Ongoing', delivery_date: '22/05/26', comments: null },
  { number: 22, title: 'Influx Management Plan', status: 'Ongoing', delivery_date: '22/05/26', comments: null },
  { number: 23, title: 'Cultural Heritage Management Plan', status: 'Ongoing', delivery_date: '22/05/26', comments: null },
  { number: 24, title: 'VGN / SEA / SH Action Plan', status: 'Ongoing', delivery_date: '22/05/26', comments: null },
  { number: 25, title: 'Climate Change Risk Assessment', status: 'Ongoing', delivery_date: '22/05/26', comments: null },
  { number: 26, title: 'Hitech Strategic Environmental & Social Objectives', status: 'Ongoing', delivery_date: '22/05/26', comments: null },
  { number: 27, title: 'Resettlement Policy Framework', status: 'Ongoing', delivery_date: '22/05/26', comments: null },
  { number: 28, title: 'Livelihood Restoration Plan', status: 'No', delivery_date: null, comments: null },
];

const lcch4Deliverables = [
  { number: 0,  title: 'ESG Compliance Roadmap', status: 'Ongoing', delivery_date: '22/05/26', comments: null },
  { number: 1,  title: 'E&S Impact Assessment', status: 'Ongoing', delivery_date: '22/05/26', comments: 'National one has not been received. We are preparing a Supplementary ESIA aligned with IFC PS desktop based with only supplementary data collection in the meantime. This is good practice for lenders as construction has not started.' },
  { number: 2,  title: 'Stakeholder Engagement Plan', status: 'Ongoing', delivery_date: '22/05/26', comments: 'Under review' },
  { number: 3,  title: 'Stakeholder Engagement Plan Framework', status: 'No', delivery_date: null, comments: null },
  { number: 4,  title: 'Human Rights Impact Screening', status: 'Ongoing', delivery_date: '22/05/26', comments: 'Under review' },
  { number: 5,  title: 'Human Rights Risk Assessment', status: 'No', delivery_date: null, comments: null },
  { number: 6,  title: 'Environmental and Social Management System Guidance Note', status: 'No', delivery_date: null, comments: null },
  { number: 7,  title: 'Commitment to Sustainability Policy', status: 'Yes', delivery_date: null, comments: null },
  { number: 8,  title: 'Human Rights and Security Manual', status: 'Yes', delivery_date: null, comments: null },
  { number: 9,  title: 'Environmental and Social Management System Framework', status: 'Yes', delivery_date: null, comments: null },
  { number: 10, title: 'Code of Conduct', status: 'Yes', delivery_date: null, comments: null },
  { number: 11, title: 'Dust Management Plan', status: 'Ongoing', delivery_date: '22/05/26', comments: null },
  { number: 12, title: 'Environmental Construction Method Statement', status: 'Yes', delivery_date: null, comments: null },
  { number: 13, title: 'Soil And Water & Construction Contaminated Land Management Plan', status: 'Ongoing', delivery_date: '22/05/26', comments: null },
  { number: 14, title: 'Waste Management Plan', status: 'Ongoing', delivery_date: '22/05/26', comments: null },
  { number: 15, title: 'Wastewater Management Plan', status: 'Ongoing', delivery_date: '22/05/26', comments: null },
  { number: 16, title: 'Biodiversity Management Plan', status: 'Ongoing', delivery_date: '22/05/26', comments: null },
  { number: 17, title: 'Site Rehabilitation And Restoration Management Plan', status: 'Ongoing', delivery_date: '22/05/26', comments: null },
  { number: 18, title: 'Occupational Health And Safety Management Plan', status: 'Ongoing', delivery_date: '22/05/26', comments: null },
  { number: 19, title: 'Community Health And Safety Management Plan', status: 'Ongoing', delivery_date: '22/05/26', comments: null },
  { number: 20, title: 'Security Management Plan', status: 'Ongoing', delivery_date: '22/05/26', comments: null },
  { number: 21, title: 'Supplier And Contractor Management Plan', status: 'Ongoing', delivery_date: '22/05/26', comments: null },
  { number: 22, title: 'Human Resources Management Plan', status: 'Ongoing', delivery_date: '22/05/26', comments: null },
  { number: 23, title: 'Influx Management Plan', status: 'Ongoing', delivery_date: '22/05/26', comments: null },
  { number: 24, title: 'Cultural Heritage Management Plan', status: 'Ongoing', delivery_date: '22/05/26', comments: null },
  { number: 25, title: 'VGN / SEA / SH Action Plan', status: 'Ongoing', delivery_date: '22/05/26', comments: null },
  { number: 26, title: 'Climate Change Risk Assessment', status: 'Ongoing', delivery_date: '22/05/26', comments: null },
  { number: 27, title: 'Hitech Strategic Environmental & Social Objectives', status: 'Ongoing', delivery_date: '22/05/26', comments: null },
  { number: 28, title: 'Resettlement Policy Framework', status: 'Ongoing', delivery_date: '22/05/26', comments: null },
  { number: 29, title: 'Livelihood Restoration Plan', status: 'No', delivery_date: null, comments: null },
];

async function run() {
  console.log('Clearing old data...');
  await supabase.from('files').delete().neq('id', 0);
  await supabase.from('deliverables').delete().neq('id', 0);
  await supabase.from('sections').delete().neq('id', 0);

  async function insertSection(name) {
    const { data, error } = await supabase.from('sections').insert({ name }).select('id').single();
    if (error) throw error;
    console.log(`  Section "${name}" -> id ${data.id}`);
    return data.id;
  }

  async function insertDeliverables(sectionId, rows) {
    const { error } = await supabase.from('deliverables').insert(rows.map(r => ({ section_id: sectionId, ...r })));
    if (error) throw error;
  }

  console.log('Seeding sections & deliverables...');

  for (const name of ['SBS', 'SBS 3', 'TSS 1']) {
    const sid = await insertSection(name);
    await insertDeliverables(sid, [
      ...commonDeliverables.map((title, i) => ({ number: i + 1, title, status: 'No', delivery_date: null, comments: null, is_doc_type: false })),
      ...docTypes.map(title => ({ number: null, title, status: 'No', delivery_date: null, comments: null, is_doc_type: true })),
    ]);
  }

  const lcch3Id = await insertSection('LCCH 3');
  await insertDeliverables(lcch3Id, [
    ...lcch3Deliverables.map(r => ({ ...r, is_doc_type: false })),
    ...docTypes.map(title => ({ number: null, title, status: 'No', delivery_date: null, comments: null, is_doc_type: true })),
  ]);

  const lcch4Id = await insertSection('LCCH 4');
  await insertDeliverables(lcch4Id, [
    ...lcch4Deliverables.map(r => ({ ...r, is_doc_type: false })),
    ...docTypes.map(title => ({ number: null, title, status: 'No', delivery_date: null, comments: null, is_doc_type: true })),
  ]);

  console.log('Done!');
}

run().catch(console.error);
