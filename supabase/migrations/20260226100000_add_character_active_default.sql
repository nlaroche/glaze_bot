ALTER TABLE public.characters
  ADD COLUMN is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN is_default boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX characters_is_default_unique
  ON public.characters (is_default) WHERE is_default = true;

CREATE INDEX characters_is_active_idx
  ON public.characters (is_active) WHERE is_active = true;
