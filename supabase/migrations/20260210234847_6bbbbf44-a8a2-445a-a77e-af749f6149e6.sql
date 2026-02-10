-- Fix: vendor transfer fails because WITH CHECK defaults to USING
-- After transfer, assigned_to changes → old USING no longer matches the new row
-- Solution: explicit WITH CHECK that only enforces tenant isolation

DROP POLICY IF EXISTS rls_wa_conversations_update_vendor ON wa_conversations;

CREATE POLICY rls_wa_conversations_update_vendor
  ON wa_conversations
  FOR UPDATE
  TO authenticated
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
              SELECT 1 FROM vendedores v
              WHERE v.id = wi.vendedor_id
                AND v.user_id = auth.uid()
                AND v.ativo = true
            )
          )
      )
    )
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id()
  );