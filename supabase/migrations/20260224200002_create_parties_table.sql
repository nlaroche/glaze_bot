CREATE TABLE IF NOT EXISTS parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'My Party',
  member_ids uuid[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT party_max_members CHECK (array_length(member_ids, 1) IS NULL OR array_length(member_ids, 1) <= 3)
);

-- Only one active party per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_parties_user_active ON parties(user_id) WHERE is_active = true;

-- RLS
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own parties"
    ON parties FOR SELECT
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own parties"
    ON parties FOR INSERT
    WITH CHECK ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own parties"
    ON parties FOR UPDATE
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own parties"
    ON parties FOR DELETE
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
