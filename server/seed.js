const supabase = require('./db');

const commonDeliverables = [
  'E&S Impact Assessment','Stakeholder Engagement Plan','Stakeholder Engagement Plan Framework',
  'Human Rights Impact Assessment','Human Rights Risk Assessment',
  'Environmental and Social Management System Guidance Note','Commitment to Sustainability Policy',
  'Human Rights and Security Manual','Environmental and Social Management System Framework',
  'Code of Conduct','Dust Management Plan','Environmental Construction Method Statement',
  'Soil And Water & Construction Contaminated Land Management Plan','Waste Management Plan',
  'Wastewater Management Plan','Biodiversity Management Plan',
  'Site Rehabilitation And Restoration Management Plan',
  'Occupational Health And Safety Management Plan','Community Health And Safety Management Plan',
  'Security Management Plan','Supplier And Contractor Management Plan',
  'Human Resources Management Plan','Influx Management Plan','Cultural Heritage Management Plan',
  'VGN / SEA / SH Action Plan','Climate Change Risk Assessment',
  'Hitech Strategic Environmental & Social Objectives','Resettlement Action Plan','Livelihood Restoration Plan',
];

const docTypes = ['AWARD LETTER','BEME','CONTRACT','DESIGN FILE','KMZ'];

const USERS = [
  { username: 'rudy.choufani@skykapital.com', password_hash: '$2a$10$mcYxMyjOfltIciGHMXkF/OTeX3uGoABk2LVWTqCjd53BoAkBVq6qC', role: 'admin' },
];

async function seedIfNeeded() {
  // Insert seed users only if missing — never overwrite existing rows,
  // so password/role changes made via User Access are preserved across restarts.
  await supabase.from('users').upsert(USERS, { onConflict: 'username', ignoreDuplicates: true });

  const { data: existing } = await supabase.from('sections').select('id').limit(1);
  if (existing && existing.length > 0) return;

  console.log('Seeding database...');

  async function insertSection(name) {
    const { data } = await supabase.from('sections').insert({ name }).select('id').single();
    return data.id;
  }

  async function insertDeliverables(sectionId, items) {
    await supabase.from('deliverables').insert(items.map(item => ({ section_id: sectionId, ...item })));
  }

  for (const name of ['SBS', 'SBS 3', 'TSS 1']) {
    const sectionId = await insertSection(name);
    await insertDeliverables(sectionId, [
      ...commonDeliverables.map((title, i) => ({ number: i+1, title, status: 'No', delivery_date: null, comments: null, is_doc_type: false })),
      ...docTypes.map(title => ({ number: null, title, status: 'No', delivery_date: null, comments: null, is_doc_type: true })),
    ]);
  }

  const lcch3Id = await insertSection('LCCH 3');
  await insertDeliverables(lcch3Id, [
    { number:0, title:'ESG Compliance Roadmap', status:'Ongoing', delivery_date:'22/05/26', comments:null, is_doc_type:false },
    { number:1, title:'Stakeholder Engagement Plan', status:'Ongoing', delivery_date:'22/05/26', comments:'Under review', is_doc_type:false },
    { number:2, title:'Stakeholder Engagement Plan Framework', status:'No', delivery_date:null, comments:null, is_doc_type:false },
    { number:3, title:'Human Rights Impact Screening', status:'Ongoing', delivery_date:'22/05/26', comments:'Under review', is_doc_type:false },
    { number:4, title:'Human Rights Risk Assessment', status:'No', delivery_date:null, comments:null, is_doc_type:false },
    { number:5, title:'Environmental and Social Management System Guidance Note', status:'No', delivery_date:null, comments:null, is_doc_type:false },
    { number:6, title:'Commitment to Sustainability Policy', status:'Yes', delivery_date:null, comments:null, is_doc_type:false },
    { number:7, title:'Human Rights and Security Manual', status:'Yes', delivery_date:null, comments:null, is_doc_type:false },
    { number:8, title:'Environmental and Social Management System Framework', status:'Yes', delivery_date:null, comments:null, is_doc_type:false },
    { number:9, title:'Code of Conduct', status:'Yes', delivery_date:null, comments:null, is_doc_type:false },
    { number:10, title:'Dust Management Plan', status:'Ongoing', delivery_date:'22/05/26', comments:null, is_doc_type:false },
    { number:11, title:'Environmental Construction Method Statement', status:'Yes', delivery_date:null, comments:null, is_doc_type:false },
    { number:12, title:'Soil And Water & Construction Contaminated Land Management Plan', status:'Ongoing', delivery_date:'22/05/26', comments:null, is_doc_type:false },
    { number:13, title:'Waste Management Plan', status:'Ongoing', delivery_date:'22/05/26', comments:null, is_doc_type:false },
    { number:14, title:'Wastewater Management Plan', status:'Ongoing', delivery_date:'22/05/26', comments:null, is_doc_type:false },
    { number:15, title:'Biodiversity Management Plan', status:'Ongoing', delivery_date:'22/05/26', comments:null, is_doc_type:false },
    { number:16, title:'Site Rehabilitation And Restoration Management Plan', status:'Ongoing', delivery_date:'22/05/26', comments:null, is_doc_type:false },
    { number:17, title:'Occupational Health And Safety Management Plan', status:'Ongoing', delivery_date:'22/05/26', comments:null, is_doc_type:false },
    { number:18, title:'Community Health And Safety Management Plan', status:'Ongoing', delivery_date:'22/05/26', comments:null, is_doc_type:false },
    { number:19, title:'Security Management Plan', status:'Ongoing', delivery_date:'22/05/26', comments:null, is_doc_type:false },
    { number:20, title:'Supplier And Contractor Management Plan', status:'Ongoing', delivery_date:'22/05/26', comments:null, is_doc_type:false },
    { number:21, title:'Human Resources Management Plan', status:'Ongoing', delivery_date:'22/05/26', comments:null, is_doc_type:false },
    { number:22, title:'Influx Management Plan', status:'Ongoing', delivery_date:'22/05/26', comments:null, is_doc_type:false },
    { number:23, title:'Cultural Heritage Management Plan', status:'Ongoing', delivery_date:'22/05/26', comments:null, is_doc_type:false },
    { number:24, title:'VGN / SEA / SH Action Plan', status:'Ongoing', delivery_date:'22/05/26', comments:null, is_doc_type:false },
    { number:25, title:'Climate Change Risk Assessment', status:'Ongoing', delivery_date:'22/05/26', comments:null, is_doc_type:false },
    { number:26, title:'Hitech Strategic Environmental & Social Objectives', status:'Ongoing', delivery_date:'22/05/26', comments:null, is_doc_type:false },
    { number:27, title:'Resettlement Policy Framework', status:'Ongoing', delivery_date:'22/05/26', comments:null, is_doc_type:false },
    { number:28, title:'Livelihood Restoration Plan', status:'No', delivery_date:null, comments:null, is_doc_type:false },
    ...docTypes.map(title => ({ number:null, title, status:'No', delivery_date:null, comments:null, is_doc_type:true })),
  ]);

  const lcch4Id = await insertSection('LCCH 4');
  await insertDeliverables(lcch4Id, [
    { number:0, title:'ESG Compliance Roadmap', status:'Ongoing', delivery_date:'22/05/26', comments:null, is_doc_type:false },
    { number:1, title:'E&S Impact Assessment', status:'Ongoing', delivery_date:'22/05/26', comments:'National one has not been received. We are preparing a Supplementary ESIA aligned with Ifc PS desktop based with only supplementary data collection in the meantime. This is good practice for lenders as construction has not started.', is_doc_type:false },
    { number:2, title:'Stakeholder Engagement Plan', status:'Ongoing', delivery_date:'22/05/26', comments:'Under review', is_doc_type:false },
    { number:3, title:'Stakeholder Engagement Plan Framework', status:'No', delivery_date:null, comments:null, is_doc_type:false },
    { number:4, title:'Human Rights Impact Screening', status:'Ongoing', delivery_date:'22/05/26', comments:'Under review', is_doc_type:false },
    { number:5, title:'Human Rights Risk Assessment', status:'No', delivery_date:null, comments:null, is_doc_type:false },
    { number:6, title:'Environmental and Social Management System Guidance Note', status:'No', delivery_date:null, comments:null, is_doc_type:false },
    { number:7, title:'Commitment to Sustainability Policy', status:'Yes', delivery_date:null, comments:null, is_doc_type:false },
    { number:8, title:'Human Rights and Security Manual', status:'Yes', delivery_date:null, comments:null, is_doc_type:false },
    { number:9, title:'Environmental and Social Management System Framework', status:'Yes', delivery_date:null, comments:null, is_doc_type:false },
    { number:10, title:'Code of Conduct', status:'Yes', delivery_date:null, comments:null, is_doc_type:false },
    { number:11, title:'Dust Management Plan', status:'Ongoing', delivery_date:'22/05/26', comments:null, is_doc_type:false },
    { number:12, title:'Environmental Construction Method Statement', status:'Yes', delivery_date:null, comments:null, is_doc_type:false },
    { number:13, title:'Soil And Water & Construction Contaminated Land Management Plan', status:'Ongoing', delivery_date:'22/05/26', comments:null, is_doc_type:false },
    { number:14, title:'Waste Management Plan', status:'Ongoing', delivery_date:'22/05/26', comments:null, is_doc_type:false },
    { number:15, title:'Wastewater Management Plan', status:'Ongoing', delivery_date:'22/05/26', comments:null, is_doc_type:false },
    { number:16, title:'Biodiversity Management Plan', status:'Ongoing', delivery_date:'22/05/26', comments:null, is_doc_type:false },
    { number:17, title:'Site Rehabilitation And Restoration Management Plan', status:'Ongoing', delivery_date:'22/05/26', comments:null, is_doc_type:false },
    { number:18, title:'Occupational Health And Safety Management Plan', status:'Ongoing', delivery_date:'22/05/26', comments:null, is_doc_type:false },
    { number:19, title:'Community Health And Safety Management Plan', status:'Ongoing', delivery_date:'22/05/26', comments:null, is_doc_type:false },
    { number:20, title:'Security Management Plan', status:'Ongoing', delivery_date:'22/05/26', comments:null, is_doc_type:false },
    { number:21, title:'Supplier And Contractor Management Plan', status:'Ongoing', delivery_date:'22/05/26', comments:null, is_doc_type:false },
    { number:22, title:'Human Resources Management Plan', status:'Ongoing', delivery_date:'22/05/26', comments:null, is_doc_type:false },
    { number:23, title:'Influx Management Plan', status:'Ongoing', delivery_date:'22/05/26', comments:null, is_doc_type:false },
    { number:24, title:'Cultural Heritage Management Plan', status:'Ongoing', delivery_date:'22/05/26', comments:null, is_doc_type:false },
    { number:25, title:'VGN / SEA / SH Action Plan', status:'Ongoing', delivery_date:'22/05/26', comments:null, is_doc_type:false },
    { number:26, title:'Climate Change Risk Assessment', status:'Ongoing', delivery_date:'22/05/26', comments:null, is_doc_type:false },
    { number:27, title:'Hitech Strategic Environmental & Social Objectives', status:'Ongoing', delivery_date:'22/05/26', comments:null, is_doc_type:false },
    { number:28, title:'Resettlement Policy Framework', status:'Ongoing', delivery_date:'22/05/26', comments:null, is_doc_type:false },
    { number:29, title:'Livelihood Restoration Plan', status:'No', delivery_date:null, comments:null, is_doc_type:false },
    ...docTypes.map(title => ({ number:null, title, status:'No', delivery_date:null, comments:null, is_doc_type:true })),
  ]);

  await supabase.from('seed_done').insert({ id: 1 });
  console.log('Database seeded successfully.');
}

module.exports = { seedIfNeeded };
