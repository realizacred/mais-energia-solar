
-- Create datasheets bucket (public, PDF only, 20MB max)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('datasheets', 'datasheets', true, 20971520, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to datasheets bucket
CREATE POLICY "Authenticated users can upload datasheets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'datasheets');

-- Allow public read access to datasheets
CREATE POLICY "Public read access for datasheets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'datasheets');

-- Allow service role and authenticated to update/delete
CREATE POLICY "Authenticated users can update datasheets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'datasheets');

CREATE POLICY "Authenticated users can delete datasheets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'datasheets');
