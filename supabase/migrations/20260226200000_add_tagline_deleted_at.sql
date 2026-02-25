-- Add tagline, tagline_url, and soft-delete columns to characters
ALTER TABLE public.characters
  ADD COLUMN tagline text NOT NULL DEFAULT '',
  ADD COLUMN tagline_url text,
  ADD COLUMN deleted_at timestamptz;

CREATE INDEX characters_deleted_at_idx
  ON public.characters (deleted_at) WHERE deleted_at IS NOT NULL;

-- Update SELECT policy to hide soft-deleted characters from users
-- (service role bypasses RLS, so admins can still see them)
DROP POLICY IF EXISTS "Users can view own characters" ON characters;
CREATE POLICY "Users can view own characters"
  ON characters FOR SELECT
  USING ((select auth.uid()) = user_id AND deleted_at IS NULL);

-- Admin RPC to list soft-deleted characters
CREATE OR REPLACE FUNCTION get_deleted_characters()
RETURNS SETOF characters
LANGUAGE sql SECURITY DEFINER
AS $$ SELECT * FROM characters WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC; $$;
