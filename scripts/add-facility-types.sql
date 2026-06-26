-- Allow facility features (points and areas) in map_features
ALTER TABLE map_features DROP CONSTRAINT IF EXISTS map_features_type_check;
ALTER TABLE map_features ADD CONSTRAINT map_features_type_check
  CHECK (type IN ('road', 'extraction', 'facility', 'facility_area'));
