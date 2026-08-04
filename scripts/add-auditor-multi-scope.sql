-- Multi-scope auditor accounts: one login can cover several projects and/or
-- several individual sections (previously limited to one of each).
--
-- Run this once in the Supabase SQL Editor. Until it is run the app keeps
-- working with the old one-project-per-auditor behaviour.

ALTER TABLE users ADD COLUMN IF NOT EXISTS scope_project_ids     INT[] DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS scope_sub_section_ids INT[] DEFAULT '{}';

-- Carry any existing single-value scopes over into the new arrays
UPDATE users
   SET scope_project_ids = ARRAY[scope_project_id]
 WHERE scope_project_id IS NOT NULL
   AND (scope_project_ids IS NULL OR scope_project_ids = '{}');

UPDATE users
   SET scope_sub_section_ids = ARRAY[scope_sub_section_id]
 WHERE scope_sub_section_id IS NOT NULL
   AND (scope_sub_section_ids IS NULL OR scope_sub_section_ids = '{}');
