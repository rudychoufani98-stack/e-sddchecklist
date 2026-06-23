require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function run() {
  const { data, error } = await supabase
    .from('grievances')
    .select('id, status, proposed_resolution, resolving_solution');
  if (error) throw error;

  const targets = data.filter(g =>
    g.status === 'closed' &&
    (!g.resolving_solution || !g.resolving_solution.trim()) &&
    g.proposed_resolution && g.proposed_resolution.trim()
  );

  console.log(`Backfilling ${targets.length} closed grievances...`);
  let done = 0;
  for (const g of targets) {
    const { error: e } = await supabase
      .from('grievances')
      .update({ resolving_solution: g.proposed_resolution.trim() })
      .eq('id', g.id);
    if (e) { console.error(`  id ${g.id} failed:`, e.message); continue; }
    done++;
  }
  console.log(`Done. Backfilled ${done}/${targets.length}.`);
}

run().catch(console.error);
