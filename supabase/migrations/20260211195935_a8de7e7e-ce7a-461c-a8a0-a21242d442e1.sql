
-- =============================================
-- HARDENING: wa_instance_vendedores
-- =============================================

-- Admin do tenant pode gerenciar todos os vínculos
CREATE POLICY "rls_wa_instance_vendedores_admin_all"
ON public.wa_instance_vendedores
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

-- Vendedor pode ver somente seus próprios vínculos
CREATE POLICY "rls_wa_instance_vendedores_vendor_select_own"
ON public.wa_instance_vendedores
FOR SELECT
TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  AND EXISTS (
    SELECT 1 FROM vendedores v
    WHERE v.id = wa_instance_vendedores.vendedor_id
      AND v.user_id = auth.uid()
      AND v.tenant_id = get_user_tenant_id()
  )
);

-- =============================================
-- HARDENING: vendedores anon select com tenant scoping
-- =============================================

-- Remove policy anterior (criada na migração passada)
DROP POLICY IF EXISTS "vendedores_select_anon_safe" ON public.vendedores;

-- Recria com filtro de tenant público
CREATE POLICY "vendedores_select_anon_scoped"
ON public.vendedores
FOR SELECT
TO anon
USING (
  ativo = true
  AND tenant_id = resolve_public_tenant_id()
);
