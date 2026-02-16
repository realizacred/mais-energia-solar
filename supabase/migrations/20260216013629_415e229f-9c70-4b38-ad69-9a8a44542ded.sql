-- Allow authenticated users to upload to irradiance-source bucket
CREATE POLICY "Auth upload irradiance-source"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'irradiance-source');

-- Allow authenticated users to update (upsert) files in irradiance-source
CREATE POLICY "Auth update irradiance-source"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'irradiance-source')
WITH CHECK (bucket_id = 'irradiance-source');