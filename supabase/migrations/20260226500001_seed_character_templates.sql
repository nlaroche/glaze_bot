-- Seed character_templates from the existing 16 characters in the DB.
-- Uses the same UUIDs so CDN avatar paths (if any) remain valid.
INSERT INTO public.character_templates (
  id, name, description, backstory, system_prompt, personality,
  rarity, voice_id, voice_name, avatar_seed, avatar_url, tagline, tagline_url, is_active, created_at
)
SELECT
  c.id, c.name, c.description, c.backstory, c.system_prompt, c.personality,
  c.rarity, c.voice_id, c.voice_name, c.avatar_seed, c.avatar_url, c.tagline, c.tagline_url, true, c.created_at
FROM public.characters c
WHERE c.id IN (
  '8dfbd1f5-e80b-4a91-a5db-d0aa55cb6169',
  '71daeff5-1e56-41ef-8a10-a9fa186cdf38',
  '7b61c880-07db-4ace-838a-95a937ad3ad0',
  '94c79f0e-3ff2-4d82-aa0b-f9ffaf0e7bdd',
  '5add618e-5f1a-4d8f-8ee4-1d68f2fead4c',
  '47464cf9-9dca-4032-9325-c91d035282e6',
  '597f6393-8264-4cf0-bf72-a84390cb7a5e',
  'af1e9703-14f5-4da0-ac04-8a0b09cd1633',
  '02d84369-e7c9-455f-bbeb-aca182f273dd',
  '66bf73a4-eb11-4fc9-bac2-4754aa172b3f',
  'dafaadfe-aefa-4bf8-9292-64e079ad19b4',
  'bcf310ec-f7d4-4535-bb22-d869e243b776',
  'a169f307-7de3-440d-b1e7-688527b4cf19',
  'ab22b103-ff13-4394-bfd7-1b2a9e8ba26d',
  'a516dd1d-849b-4a5f-8c4c-f518122d71c4',
  '65483db7-2d0f-40b5-991d-4d4fde78bb57'
)
ON CONFLICT (id) DO NOTHING;
