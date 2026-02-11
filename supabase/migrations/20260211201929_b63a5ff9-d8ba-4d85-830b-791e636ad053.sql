
-- Service role: ALL (sem restrição)
DROP POLICY IF EXISTS "rls_wa_instance_vendedores_service" ON wa_instance_vendedores;
CREATE POLICY "rls_wa_instance_vendedores_service"
ON wa_instance_vendedores
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Admin: ALL dentro do tenant
DROP POLICY IF EXISTS "rls_wa_instance_vendedores_admin_all" ON wa_instance_vendedores;
CREATE POLICY "rls_wa_instance_vendedores_admin_all"
ON wa_instance_vendedores
FOR ALL
TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  AND is_admin(auth.uid())
)
WITH CHECK (
  tenant_id = get_user_tenant_id()
  AND is_admin(auth.uid())
);

-- Vendor: SELECT apenas do próprio vínculo
DROP POLICY IF EXISTS "rls_wa_instance_vendedores_vendor_select_own" ON wa_instance_vendedores;
CREATE POLICY "rls_wa_instance_vendedores_vendor_select_own"
ON wa_instance_vendedores
FOR SELECT
TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  AND EXISTS (
    SELECT 1
    FROM vendedores v
    WHERE v.id = wa_instance_vendedores.vendedor_id
      AND v.user_id = auth.uid()
      AND v.tenant_id = get_user_tenant_id()
  )
);
