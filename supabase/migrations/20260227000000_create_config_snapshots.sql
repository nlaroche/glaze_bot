CREATE TABLE IF NOT EXISTS config_snapshots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL DEFAULT '',
  comments    text NOT NULL DEFAULT '',
  config      jsonb NOT NULL,
  is_favorite boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE config_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON config_snapshots FOR SELECT USING (true);
