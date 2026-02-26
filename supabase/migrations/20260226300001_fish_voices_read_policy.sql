-- Allow authenticated users to read fish_voices (public catalog)
CREATE POLICY "Authenticated users can read fish_voices"
  ON public.fish_voices
  FOR SELECT
  TO authenticated
  USING (true);
