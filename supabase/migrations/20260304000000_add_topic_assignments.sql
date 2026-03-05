-- Add per-character topic assignments and custom topics columns
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS topic_assignments jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS custom_topics jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.character_templates
  ADD COLUMN IF NOT EXISTS topic_assignments jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.character_templates
  ADD COLUMN IF NOT EXISTS custom_topics jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.characters.topic_assignments IS 'Per-character topic weights: { "solo_observation": 25, "question": 15, ... }';
COMMENT ON COLUMN public.characters.custom_topics IS 'Legendary-only unique topics: [{ key, label, prompt, weight }]';
COMMENT ON COLUMN public.character_templates.topic_assignments IS 'Per-template topic weights: { "solo_observation": 25, "question": 15, ... }';
COMMENT ON COLUMN public.character_templates.custom_topics IS 'Legendary-only unique topics: [{ key, label, prompt, weight }]';
