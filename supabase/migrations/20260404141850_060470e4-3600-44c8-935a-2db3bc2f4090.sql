-- Drop the old restrictive update policy for consultors
DROP POLICY IF EXISTS rls_clientes_update_consultor ON clientes;

-- Recreate with broader access: consultor can update clients linked via lead OR projeto/deal
CREATE POLICY rls_clientes_update_consultor ON clientes
  FOR UPDATE TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND tenant_and_user_active()
    AND (
      -- Original: client linked via lead assigned to consultor
      (lead_id IN (
        SELECT l.id FROM leads l
        WHERE l.tenant_id = get_user_tenant_id()
        AND l.consultor_id IN (
          SELECT v.id FROM consultores v
          WHERE v.user_id = auth.uid()
          AND v.tenant_id = get_user_tenant_id()
          AND v.ativo = true
        )
      ))
      OR
      -- New: client linked to a project owned by the consultor
      (id IN (
        SELECT p.cliente_id FROM projetos p
        WHERE p.tenant_id = get_user_tenant_id()
        AND p.consultor_id IN (
          SELECT v.id FROM consultores v
          WHERE v.user_id = auth.uid()
          AND v.tenant_id = get_user_tenant_id()
          AND v.ativo = true
        )
      ))
    )
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND tenant_and_user_active()
  );