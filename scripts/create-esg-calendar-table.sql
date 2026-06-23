-- ESG Calendar: deliverable deadlines per project / sub-section
CREATE TABLE IF NOT EXISTS esg_calendar (
  id SERIAL PRIMARY KEY,
  project      VARCHAR(150) NOT NULL,
  sub_section  VARCHAR(150),
  deliverable  VARCHAR(300) NOT NULL,
  deadline     DATE NOT NULL,
  status       VARCHAR(30) DEFAULT 'pending',  -- pending | done
  notes        TEXT,
  created_by   VARCHAR(200),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_esg_calendar_deadline ON esg_calendar(deadline);
CREATE INDEX IF NOT EXISTS idx_esg_calendar_project  ON esg_calendar(project);
