-- Create bucket for project documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('projeto-documentos', 'projeto-documentos', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: Users can view their tenant's project documents
CREATE POLICY "Tenant users can view project docs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'projeto-documentos'
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
);

-- RLS: Users can upload project documents to their tenant folder
CREATE POLICY "Tenant users can upload project docs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'projeto-documentos'
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
);

-- RLS: Users can delete their tenant's project documents
CREATE POLICY "Tenant users can delete project docs"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'projeto-documentos'
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
);