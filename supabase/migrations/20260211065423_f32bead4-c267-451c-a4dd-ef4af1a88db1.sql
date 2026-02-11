-- Fix: wa_conversations UPDATE policy — usar junction table (mesmo padrão do SELECT fixado)
DROP POLICY IF EXISTS "rls_wa_conversations_update_vendor" ON wa_conversations;

CREATE POLICY "rls_wa_conversations_update_vendor"
ON wa_conversations FOR UPDATE
USING (
  tenant_id = get_user_tenant_id()
  AND NOT is_admin(auth.uid())
  AND (
    assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM wa_instances wi
      WHERE wi.id = wa_conversations.instance_id
        AND wi.tenant_id = get_user_tenant_id()
        AND (
          wi.owner_user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM wa_instance_vendedores wiv
            JOIN vendedores v ON v.id = wiv.vendedor_id
            WHERE wiv.instance_id = wi.id
              AND v.user_id = auth.uid()
              AND v.ativo = true
          )
        )
    )
  )
)
WITH CHECK (tenant_id = get_user_tenant_id());