INSERT INTO storage.buckets (id, name, public)
VALUES ('character-sprites', 'character-sprites', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload sprites
CREATE POLICY "Users can upload character sprites"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'character-sprites');

-- Allow public read access to sprites
CREATE POLICY "Public read access to character sprites"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'character-sprites');
