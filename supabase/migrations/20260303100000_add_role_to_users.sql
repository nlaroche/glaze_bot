-- Add role column to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user';

-- Index for role lookups
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users (role);

-- Users can read their own row (needed to fetch role client-side)
CREATE POLICY "users_select_own"
  ON public.users
  FOR SELECT
  USING (auth.uid() = id);
