-- Add gerente role to documentos-clientes bucket policies (INSERT/SELECT/UPDATE/DELETE)
-- Maintains tenant isolation via path {tenant_id}/...

DROP POLICY IF EXISTS storage_doc_clientes_insert_gerente ON storage.objects;
DROP POLICY IF EXISTS storage_doc_clientes_select_gerente ON storage.objects;
DROP POLICY IF EXISTS storage_doc_clientes_update_gerente ON storage.objects;
DROP POLICY IF EXISTS storage_doc_clientes_delete_gerente ON storage.objects;

CREATE POLICY storage_doc_clientes_insert_gerente
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documentos-clientes'
  AND has_role(auth.uid(), 'gerente'::app_role)
  AND (storage.foldername(name))[1] = (get_user_tenant_id())::text
);

CREATE POLICY storage_doc_clientes_select_gerente
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documentos-clientes'
  AND has_role(auth.uid(), 'gerente'::app_role)
  AND (storage.foldername(name))[1] = (get_user_tenant_id())::text
);

CREATE POLICY storage_doc_clientes_update_gerente
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'documentos-clientes'
  AND has_role(auth.uid(), 'gerente'::app_role)
  AND (storage.foldername(name))[1] = (get_user_tenant_id())::text
)
WITH CHECK (
  bucket_id = 'documentos-clientes'
  AND has_role(auth.uid(), 'gerente'::app_role)
  AND (storage.foldername(name))[1] = (get_user_tenant_id())::text
);

CREATE POLICY storage_doc_clientes_delete_gerente
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documentos-clientes'
  AND has_role(auth.uid(), 'gerente'::app_role)
  AND (storage.foldername(name))[1] = (get_user_tenant_id())::text
);