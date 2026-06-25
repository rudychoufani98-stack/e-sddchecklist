-- Comments / extra details on a map feature (extraction site or road)
CREATE TABLE IF NOT EXISTS feature_comments (
  id          BIGSERIAL PRIMARY KEY,
  feature_id  BIGINT NOT NULL REFERENCES map_features(id) ON DELETE CASCADE,
  username    TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS feature_comments_feature_idx ON feature_comments (feature_id);
