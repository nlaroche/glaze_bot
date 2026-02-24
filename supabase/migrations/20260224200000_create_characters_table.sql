-- Character rarity enum
CREATE TYPE character_rarity AS ENUM ('common', 'rare', 'epic', 'legendary');

-- Characters table
CREATE TABLE characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL,
  backstory text NOT NULL DEFAULT '',
  system_prompt text NOT NULL,
  personality jsonb NOT NULL DEFAULT '{}',
  rarity character_rarity NOT NULL DEFAULT 'common',
  voice_id text,
  voice_name text,
  avatar_seed text NOT NULL DEFAULT gen_random_uuid()::text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_characters_user_id ON characters(user_id);
CREATE INDEX idx_characters_rarity ON characters(rarity);

-- RLS
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own characters"
  ON characters FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own characters"
  ON characters FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);
