-- Create character_templates table: the master pool of characters that packs draw from
CREATE TABLE IF NOT EXISTS public.character_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  backstory text NOT NULL DEFAULT '',
  system_prompt text NOT NULL DEFAULT '',
  personality jsonb NOT NULL DEFAULT '{}'::jsonb,
  rarity public.character_rarity NOT NULL DEFAULT 'common',
  voice_id text,
  voice_name text,
  avatar_seed text NOT NULL DEFAULT '',
  avatar_url text,
  tagline text NOT NULL DEFAULT '',
  tagline_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: all authenticated users can read active templates
ALTER TABLE public.character_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active templates"
  ON public.character_templates
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Add template_id to characters to track which template a user's character came from
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.character_templates(id);

-- Index for fast duplicate detection: (user_id, template_id)
CREATE INDEX IF NOT EXISTS idx_characters_user_template
  ON public.characters (user_id, template_id)
  WHERE template_id IS NOT NULL;
