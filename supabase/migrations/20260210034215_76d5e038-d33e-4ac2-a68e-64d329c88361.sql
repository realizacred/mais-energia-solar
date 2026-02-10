
-- =============================================
-- Fix wa_messages RLS: vendor SELECT + INSERT
-- =============================================

-- Drop existing vendor policies
DROP POLICY IF EXISTS rls_wa_messages_select_vendor ON wa_messages;
DROP POLICY IF EXISTS rls_wa_messages_insert_vendor ON wa_messages;

-- New SELECT: vendor can read messages for conversations they can access
-- (assigned_to OR instance linked via vendedor_id OR owner_user_id)
CREATE POLICY rls_wa_messages_select_vendor ON wa_messages
  FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM wa_conversations wc
      JOIN wa_instances wi ON wi.id = wc.instance_id
      WHERE wc.id = wa_messages.conversation_id
        AND wc.tenant_id = get_user_tenant_id()
        AND (
          wc.assigned_to = auth.uid()
          OR wi.owner_user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM vendedores v
            WHERE v.id = wi.vendedor_id AND v.user_id = auth.uid()
          )
        )
    )
  );

-- New INSERT: vendor can insert messages for conversations they can access
CREATE POLICY rls_wa_messages_insert_vendor ON wa_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM wa_conversations wc
      JOIN wa_instances wi ON wi.id = wc.instance_id
      WHERE wc.id = wa_messages.conversation_id
        AND wc.tenant_id = get_user_tenant_id()
        AND (
          wc.assigned_to = auth.uid()
          OR wi.owner_user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM vendedores v
            WHERE v.id = wi.vendedor_id AND v.user_id = auth.uid()
          )
        )
    )
  );

-- =============================================
-- Fix wa_outbox RLS: vendor INSERT + SELECT
-- =============================================

DROP POLICY IF EXISTS rls_wa_outbox_insert_vendor ON wa_outbox;
DROP POLICY IF EXISTS rls_wa_outbox_select_vendor ON wa_outbox;

-- New SELECT: vendor can read outbox for conversations they can access
CREATE POLICY rls_wa_outbox_select_vendor ON wa_outbox
  FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM wa_conversations wc
      JOIN wa_instances wi ON wi.id = wc.instance_id
      WHERE wc.id = wa_outbox.conversation_id
        AND wc.tenant_id = get_user_tenant_id()
        AND (
          wc.assigned_to = auth.uid()
          OR wi.owner_user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM vendedores v
            WHERE v.id = wi.vendedor_id AND v.user_id = auth.uid()
          )
        )
    )
  );

-- New INSERT: vendor can insert into outbox for conversations they can access
CREATE POLICY rls_wa_outbox_insert_vendor ON wa_outbox
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM wa_conversations wc
      JOIN wa_instances wi ON wi.id = wc.instance_id
      WHERE wc.id = wa_outbox.conversation_id
        AND wc.tenant_id = get_user_tenant_id()
        AND (
          wc.assigned_to = auth.uid()
          OR wi.owner_user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM vendedores v
            WHERE v.id = wi.vendedor_id AND v.user_id = auth.uid()
          )
        )
    )
  );
