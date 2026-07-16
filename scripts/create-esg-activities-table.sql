-- ESG Activities: community activities log (events, trainings, consultations, donations...)
CREATE TABLE IF NOT EXISTS esg_activities (
  id SERIAL PRIMARY KEY,
  activity_date  DATE NOT NULL,
  project_id     INTEGER REFERENCES grv_projects(id),
  sub_section_id INTEGER REFERENCES grv_sub_sections(id),
  community_name VARCHAR(200),
  title          VARCHAR(300) NOT NULL,
  description    TEXT,
  participants   INTEGER,
  conducted_by   VARCHAR(200),
  created_by     VARCHAR(200),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_esg_activities_date    ON esg_activities(activity_date);
CREATE INDEX IF NOT EXISTS idx_esg_activities_project ON esg_activities(project_id);

-- Same defense-in-depth as the other tables (server uses the service role key)
ALTER TABLE esg_activities ENABLE ROW LEVEL SECURITY;
