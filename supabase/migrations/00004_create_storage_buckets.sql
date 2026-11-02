
-- Storage buckets for event photos and branding assets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('event-photos', 'event-photos', true,  52428800, ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('branding',     'branding',     true,  10485760, ARRAY['image/jpeg','image/png','image/webp','image/svg+xml']),
  ('selfies',      'selfies',      false, 10485760, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- event-photos: authenticated users can upload
DROP POLICY IF EXISTS "Authenticated users can upload event photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload event photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'event-photos');

-- event-photos: public can view
DROP POLICY IF EXISTS "Public can view event photos" ON storage.objects;
CREATE POLICY "Public can view event photos"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'event-photos');

-- event-photos: owners can delete
DROP POLICY IF EXISTS "Owners can delete event photos" ON storage.objects;
CREATE POLICY "Owners can delete event photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'event-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- branding: authenticated users manage their own logos
DROP POLICY IF EXISTS "Authenticated users can upload branding" ON storage.objects;
CREATE POLICY "Authenticated users can upload branding"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'branding');

DROP POLICY IF EXISTS "Public can view branding" ON storage.objects;
CREATE POLICY "Public can view branding"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'branding');

DROP POLICY IF EXISTS "Owners can update branding" ON storage.objects;
CREATE POLICY "Owners can update branding"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'branding');

-- selfies: authenticated and anon can upload
DROP POLICY IF EXISTS "Anyone can upload selfies" ON storage.objects;
CREATE POLICY "Anyone can upload selfies"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'selfies');

DROP POLICY IF EXISTS "Selfie owners can view" ON storage.objects;
CREATE POLICY "Selfie owners can view"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'selfies');