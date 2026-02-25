-- Add generation_metadata column to characters table
-- Stores per-step API request/response data from the admin generation pipeline
ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS generation_metadata jsonb;
