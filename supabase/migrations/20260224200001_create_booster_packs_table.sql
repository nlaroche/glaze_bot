CREATE TABLE booster_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opened_at timestamptz NOT NULL DEFAULT now(),
  character_ids uuid[] NOT NULL DEFAULT '{}'
);

-- Index for daily count queries
CREATE INDEX idx_booster_packs_user_opened ON booster_packs(user_id, opened_at);

-- RLS
ALTER TABLE booster_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own packs"
  ON booster_packs FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own packs"
  ON booster_packs FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);
