CREATE TABLE public.fish_voices (
  id text PRIMARY KEY,              -- Fish Audio _id
  title text NOT NULL,
  description text DEFAULT '',
  tags text[] DEFAULT '{}',
  sample_url text,                  -- public MP3 URL (nullable, ~7% don't have one)
  sample_text text,                 -- the text spoken in the sample
  task_count integer DEFAULT 0,     -- usage popularity
  like_count integer DEFAULT 0,
  author_name text,
  cover_image text,                 -- relative path on Fish Audio
  languages text[] DEFAULT '{en}',
  fetched_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- RLS: admin-only via service role (no user-facing policy needed)
ALTER TABLE public.fish_voices ENABLE ROW LEVEL SECURITY;
