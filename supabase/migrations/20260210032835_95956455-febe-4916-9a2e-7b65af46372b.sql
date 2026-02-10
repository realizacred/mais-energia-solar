
-- Fix wa_instances SELECT policy to also allow vendors linked via vendedor_id
DROP POLICY IF EXISTS rls_wa_instances_select_owner ON wa_instances;

CREATE POLICY rls_wa_instances_select_vendor ON wa_instances
FOR SELECT USING (
  tenant_id = get_user_tenant_id()
  AND (
    owner_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM vendedores v
      WHERE v.id = wa_instances.vendedor_id
        AND v.user_id = auth.uid()
        AND v.ativo = true
    )
  )
);

-- Also fix wa_conversations vendor SELECT policy to include vendedor_id-linked instances
DROP POLICY IF EXISTS rls_wa_conversations_select_vendor ON wa_conversations;

CREATE POLICY rls_wa_conversations_select_vendor ON wa_conversations
FOR SELECT USING (
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
            SELECT 1 FROM vendedores v
            WHERE v.id = wi.vendedor_id
              AND v.user_id = auth.uid()
              AND v.ativo = true
          )
        )
    )
  )
);

-- Also fix the UPDATE policy for vendors
DROP POLICY IF EXISTS rls_wa_conversations_update_vendor ON wa_conversations;

CREATE POLICY rls_wa_conversations_update_vendor ON wa_conversations
FOR UPDATE USING (
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
            SELECT 1 FROM vendedores v
            WHERE v.id = wi.vendedor_id
              AND v.user_id = auth.uid()
              AND v.ativo = true
          )
        )
    )
  )
);
