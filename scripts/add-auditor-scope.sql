-- Auditor (lender) accounts: lock a user to one grievance project / sub-section
ALTER TABLE users ADD COLUMN IF NOT EXISTS scope_project_id INT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS scope_sub_section_id INT;
