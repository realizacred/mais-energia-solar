-- RLS policies for faturas-energia bucket
-- Path pattern: {tenant_id}/...

CREATE POLICY "tenant_upload_faturas"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'faturas-energia'
  AND (storage.foldername(name))[1] = (public.current_tenant_id())::text
);

CREATE POLICY "tenant_read_faturas"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'faturas-energia'
  AND (storage.foldername(name))[1] = (public.current_tenant_id())::text
);

CREATE POLICY "tenant_delete_faturas"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'faturas-energia'
  AND (storage.foldername(name))[1] = (public.current_tenant_id())::text
);

CREATE POLICY "service_role_faturas"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'faturas-energia')
WITH CHECK (bucket_id = 'faturas-energia');
