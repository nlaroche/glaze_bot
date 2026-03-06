-- Add is_favorite column to fish_voices for admin voice curation
ALTER TABLE public.fish_voices
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_fish_voices_favorite ON public.fish_voices (is_favorite)
  WHERE is_favorite = true;

COMMENT ON COLUMN public.fish_voices.is_favorite IS 'Admin-curated favorite voice for easy filtering';

-- Allow admin users to update fish_voices (for toggling favorites)
CREATE POLICY "Admins can update fish_voices"
  ON public.fish_voices
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
