-- Update bucket to private
UPDATE storage.buckets
SET public = false
WHERE id = 'projeto-documentos';

-- INSERT policy
DROP POLICY IF EXISTS "Tenant users can upload project docs" ON storage.objects;
CREATE POLICY "Tenant users can upload project docs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'projeto-documentos' AND
    (storage.foldername(name))[1] = get_user_tenant_id()::text
  );

-- SELECT policy
DROP POLICY IF EXISTS "Tenant users can view project docs" ON storage.objects;
CREATE POLICY "Tenant users can view project docs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'projeto-documentos' AND
    (storage.foldername(name))[1] = get_user_tenant_id()::text
  );

-- DELETE policy
DROP POLICY IF EXISTS "Tenant users can delete project docs" ON storage.objects;
CREATE POLICY "Tenant users can delete project docs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'projeto-documentos' AND
    (storage.foldername(name))[1] = get_user_tenant_id()::text
  );