-- Defense-in-depth: enable Row Level Security on every table.
-- The app's server uses the SERVICE ROLE key, which BYPASSES RLS, so the app keeps
-- working unchanged. With RLS on and no policies, the public/anon API is denied by
-- default — so even if the anon key leaked, no one could read or write your data.

ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections             ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliverables         ENABLE ROW LEVEL SECURITY;
ALTER TABLE grievances           ENABLE ROW LEVEL SECURITY;
ALTER TABLE grv_projects         ENABLE ROW LEVEL SECURITY;
ALTER TABLE grv_sub_sections     ENABLE ROW LEVEL SECURITY;
ALTER TABLE construction_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE esg_calendar         ENABLE ROW LEVEL SECURITY;
ALTER TABLE map_features         ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_comments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE seed_done            ENABLE ROW LEVEL SECURITY;
