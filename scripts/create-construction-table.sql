CREATE TABLE IF NOT EXISTS construction_progress (
  id               SERIAL PRIMARY KEY,
  reporting_period DATE,
  project          VARCHAR(100),
  section          VARCHAR(100),
  sub_section      VARCHAR(50),
  component        VARCHAR(200),
  key_activities   TEXT,
  pct_progress     NUMERIC(5,2),
  status           VARCHAR(50),
  remarks          TEXT,
  prepared_by      VARCHAR(200),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
