-- Add batch_id column for grouping batch-created characters
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS batch_id text;

CREATE INDEX IF NOT EXISTS idx_characters_batch_id ON public.characters (batch_id)
  WHERE batch_id IS NOT NULL;

COMMENT ON COLUMN public.characters.batch_id IS 'Optional batch identifier for grouping characters created together (e.g. crimson_falcon_4829)';
