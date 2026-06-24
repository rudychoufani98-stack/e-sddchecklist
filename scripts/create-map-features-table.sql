-- 3D Site Map: roads (lines) and extraction sites (points) per project
CREATE TABLE IF NOT EXISTS map_features (
  id           BIGSERIAL PRIMARY KEY,
  project      TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('road', 'extraction')),
  name         TEXT NOT NULL,
  category     TEXT,
  notes        TEXT,
  color        TEXT,
  -- For 'road': array of [lng, lat] pairs. For 'extraction': single [lng, lat].
  coordinates  JSONB NOT NULL,
  created_by   TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS map_features_project_idx ON map_features (project);
