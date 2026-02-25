-- Allow users to delete their own characters
DO $$ BEGIN
  CREATE POLICY "Users can delete own characters"
    ON characters FOR DELETE
    USING ((select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
