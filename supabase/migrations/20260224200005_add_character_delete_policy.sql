-- Allow users to delete their own characters
CREATE POLICY "Users can delete own characters"
  ON characters FOR DELETE
  USING ((select auth.uid()) = user_id);
