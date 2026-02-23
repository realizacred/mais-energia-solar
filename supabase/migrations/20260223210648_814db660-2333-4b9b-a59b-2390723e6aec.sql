-- =============================================
-- Phase 10: Storage — Tenant-scope module-datasheets policies
-- =============================================

-- Drop existing non-tenant-scoped policies
DROP POLICY IF EXISTS "Datasheets são publicamente acessíveis" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem fazer upload de datasheets" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar datasheets" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar datasheets" ON storage.objects;

-- SELECT: public (bucket is public, datasheets are shared)
CREATE POLICY "storage_module_datasheets_select_public"
ON storage.objects FOR SELECT
USING (bucket_id = 'module-datasheets');

-- INSERT: authenticated + tenant path
CREATE POLICY "storage_module_datasheets_insert_auth_tenant"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'module-datasheets'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = (get_user_tenant_id())::text
);

-- UPDATE: authenticated + tenant path
CREATE POLICY "storage_module_datasheets_update_auth_tenant"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'module-datasheets'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = (get_user_tenant_id())::text
)
WITH CHECK (
  bucket_id = 'module-datasheets'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = (get_user_tenant_id())::text
);

-- DELETE: admin only + tenant path
CREATE POLICY "storage_module_datasheets_delete_admin_tenant"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'module-datasheets'
  AND is_admin(auth.uid())
  AND (storage.foldername(name))[1] = (get_user_tenant_id())::text
);