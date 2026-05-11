
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-documents', 'project-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas tenant-scoped (primeiro segmento = tenant_id)
DROP POLICY IF EXISTS "pd_storage_select" ON storage.objects;
CREATE POLICY "pd_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'project-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT tenant_id::text FROM public.profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "pd_storage_insert" ON storage.objects;
CREATE POLICY "pd_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'project-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT tenant_id::text FROM public.profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "pd_storage_update" ON storage.objects;
CREATE POLICY "pd_storage_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'project-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT tenant_id::text FROM public.profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "pd_storage_delete" ON storage.objects;
CREATE POLICY "pd_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'project-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT tenant_id::text FROM public.profiles WHERE user_id = auth.uid()
    )
  );
