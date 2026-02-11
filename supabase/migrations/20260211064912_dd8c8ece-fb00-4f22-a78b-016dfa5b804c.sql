-- Fix: RLS wa_conversations SELECT — usar junction table wa_instance_vendedores (M:N)
-- em vez do campo legado wa_instances.vendedor_id (1:1)

DROP POLICY IF EXISTS "rls_wa_conversations_select_vendor" ON wa_conversations;

CREATE POLICY "rls_wa_conversations_select_vendor"
ON wa_conversations FOR SELECT
USING (
  tenant_id = get_user_tenant_id()
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
);

-- Also fix wa_messages SELECT if it has same issue
DROP POLICY IF EXISTS "rls_wa_messages_select_vendor" ON wa_messages;

CREATE POLICY "rls_wa_messages_select_vendor"
ON wa_messages FOR SELECT
USING (
  tenant_id = get_user_tenant_id()
  AND can_access_wa_conversation(conversation_id)
);