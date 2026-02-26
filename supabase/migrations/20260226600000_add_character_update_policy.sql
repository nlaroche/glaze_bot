-- Allow users to update their own characters (needed for soft-delete and field edits)
DO $$ BEGIN
  CREATE POLICY "Users can update own characters"
    ON characters FOR UPDATE
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
