-- Allow authenticated users to upload invoice PDFs to their tenant folder
CREATE POLICY "Tenant can upload invoices"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'faturas-energia'
  AND (storage.foldername(name))[1] = (SELECT current_tenant_id())::text
);

-- Allow tenant to update (overwrite) their own invoices
CREATE POLICY "Tenant can update own invoices"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'faturas-energia'
  AND (storage.foldername(name))[1] = (SELECT current_tenant_id())::text
);
