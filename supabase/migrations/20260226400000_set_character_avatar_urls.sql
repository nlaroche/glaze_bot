-- Set avatar_url for all 16 characters using their R2-uploaded portraits
UPDATE public.characters SET avatar_url = 'https://cdn-staging.glazebot.gg/character-data/' || id || '/images/main_portrait.png'
WHERE id IN (
  '8dfbd1f5-b654-4e0d-91cb-b52340a3e0ec',
  '71daeff5-76a2-4f0d-9e48-3c60e6b2d19e',
  '7b61c880-b9af-4bd1-9e4f-8dfc77b0d1d5',
  '94c79f0e-7b10-458b-bf9a-4b15c1d6e2f8',
  '5add618e-3c78-4a2d-9f5b-7e8d2c4a1b6f',
  '47464cf9-8d5e-4f3a-b7c1-2e9a6d8f4c5b',
  '597f6393-4a2b-4d8e-9c3f-1b7e5a8d2c6f',
  'af1e9703-9c4d-4b2a-8e7f-3d6a1c5b8e9f',
  '02d84369-2b5e-4c8d-a1f3-7e9d4b6a8c2f',
  '66bf73a4-7d3a-4e9b-8c5f-2a1b6e4d9f8c',
  'dafaadfe-5c8b-4a3d-9e2f-1d7b6a4c8e5f',
  'bcf310ec-8a4d-4b7e-9c1f-3e5a2d6b8f9c',
  'a169f307-3b6e-4d2a-8f5c-9a1d7e4b8c3f',
  'ab22b103-6d4a-4c8b-9e3f-2b7a1d5e8f6c',
  'a516dd1d-4c7b-4a9d-8e2f-1d3b6a5e8c9f',
  '65483db7-9a2d-4b5e-8c7f-3e1a6d4b9f8c'
);
