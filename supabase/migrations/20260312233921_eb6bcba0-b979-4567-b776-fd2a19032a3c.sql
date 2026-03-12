-- Allow consultores to INSERT clients linked to their own leads
CREATE POLICY "rls_clientes_insert_consultor"
ON public.clientes
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = get_user_tenant_id()
  AND tenant_and_user_active()
  AND lead_id IS NOT NULL
  AND lead_id IN (
    SELECT l.id
    FROM leads l
    WHERE l.tenant_id = get_user_tenant_id()
      AND l.consultor_id IN (
        SELECT v.id
        FROM consultores v
        WHERE v.user_id = auth.uid()
          AND v.tenant_id = get_user_tenant_id()
          AND v.ativo = true
      )
  )
);

-- Allow consultores to UPDATE clients linked to their own leads
CREATE POLICY "rls_clientes_update_consultor"
ON public.clientes
FOR UPDATE
TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  AND tenant_and_user_active()
  AND lead_id IN (
    SELECT l.id
    FROM leads l
    WHERE l.tenant_id = get_user_tenant_id()
      AND l.consultor_id IN (
        SELECT v.id
        FROM consultores v
        WHERE v.user_id = auth.uid()
          AND v.tenant_id = get_user_tenant_id()
          AND v.ativo = true
      )
  )
)
WITH CHECK (
  tenant_id = get_user_tenant_id()
  AND tenant_and_user_active()
  AND lead_id IN (
    SELECT l.id
    FROM leads l
    WHERE l.tenant_id = get_user_tenant_id()
      AND l.consultor_id IN (
        SELECT v.id
        FROM consultores v
        WHERE v.user_id = auth.uid()
          AND v.tenant_id = get_user_tenant_id()
          AND v.ativo = true
      )
  )
);