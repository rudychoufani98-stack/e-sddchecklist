// ---------------------------------------------------------------------------
// Auditor (lender) scope
//
// An auditor account may be granted:
//   - whole projects      -> scope_project_ids     (all sub-sections included)
//   - individual sections -> scope_sub_section_ids (in any project)
// The two are combined with OR, so one login can cover e.g. all of LCCH plus
// only Section 1A of Sokoto Badagry.
//
// Reads fall back to the legacy single-value columns (scope_project_id /
// scope_sub_section_id) so nothing breaks before the array migration is run.
// ---------------------------------------------------------------------------

function toIdArray(value, legacy) {
  const out = [];
  if (Array.isArray(value)) {
    for (const v of value) {
      const n = parseInt(v);
      if (Number.isInteger(n)) out.push(n);
    }
  }
  if (!out.length && legacy != null) {
    const n = parseInt(legacy);
    if (Number.isInteger(n)) out.push(n);
  }
  return [...new Set(out)];
}

// Resolves a user's (or token's) granted scope into { projectIds, subSectionIds }.
//
// The legacy single columns meant project AND sub-section — i.e. "that one
// section of that project". Since the new model ORs the two lists, a legacy
// pair must collapse to the sub-section alone, otherwise a section-restricted
// auditor would silently widen to the whole project.
function resolveScope(src) {
  const projectIds    = toIdArray(src.scope_project_ids, null);
  const subSectionIds = toIdArray(src.scope_sub_section_ids, null);
  if (projectIds.length || subSectionIds.length) return { projectIds, subSectionIds };

  const legacySub = parseInt(src.scope_sub_section_id);
  if (Number.isInteger(legacySub)) return { projectIds: [], subSectionIds: [legacySub] };

  const legacyProject = parseInt(src.scope_project_id);
  if (Number.isInteger(legacyProject)) return { projectIds: [legacyProject], subSectionIds: [] };

  return { projectIds: [], subSectionIds: [] };
}

// Builds the scope carried in a login token. Used by the auth route.
function scopeClaims(user) {
  const { projectIds, subSectionIds } = resolveScope(user);
  return {
    scope_project_ids:     projectIds,
    scope_sub_section_ids: subSectionIds,
    // Kept for tokens issued before the multi-scope change
    scope_project_id:     user.scope_project_id ?? null,
    scope_sub_section_id: user.scope_sub_section_id ?? null,
  };
}

// Returns the forced scope for auditor accounts, or null for everyone else.
function auditorScope(req) {
  if (req.user?.role !== 'auditor') return null;
  return resolveScope(req.user);
}

// Restricts a Supabase query to the scope. Client-supplied filters are applied
// separately and combine with AND, so they can only ever narrow the result.
// An auditor with no scope at all sees nothing rather than everything.
function applyScope(q, scope) {
  if (!scope) return q;
  const parts = [];
  if (scope.projectIds.length)    parts.push(`project_id.in.(${scope.projectIds.join(',')})`);
  if (scope.subSectionIds.length) parts.push(`sub_section_id.in.(${scope.subSectionIds.join(',')})`);
  if (!parts.length) return q.eq('id', -1);
  return q.or(parts.join(','));
}

// Same rule applied to a single already-fetched row.
function isInScope(row, scope) {
  if (!scope) return true;
  if (scope.projectIds.includes(row.project_id)) return true;
  if (row.sub_section_id != null && scope.subSectionIds.includes(row.sub_section_id)) return true;
  return false;
}

module.exports = { scopeClaims, auditorScope, applyScope, isInScope, toIdArray, resolveScope };
