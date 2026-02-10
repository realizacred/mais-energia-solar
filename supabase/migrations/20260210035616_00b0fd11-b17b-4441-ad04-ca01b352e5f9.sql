
-- =====================================================
-- BUG-1 FIX: Create SECURITY DEFINER function to check
-- conversation access WITHOUT recursive RLS interference
-- =====================================================

CREATE OR REPLACE FUNCTION public.can_access_wa_conversation(
  _conversation_id uuid,
  _user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM wa_conversations wc
    LEFT JOIN wa_instances wi ON wi.id = wc.instance_id
    WHERE wc.id = _conversation_id
      AND wc.tenant_id = get_user_tenant_id(_user_id)
      AND (
        wc.assigned_to = _user_id
        OR wi.owner_user_id = _user_id
        OR EXISTS (
          SELECT 1 FROM vendedores v
          WHERE v.id = wi.vendedor_id
            AND v.user_id = _user_id
            AND v.ativo = true
        )
      )
  )
$$;

-- =====================================================
-- Drop old vendor-specific policies that use inline subqueries
-- =====================================================

DROP POLICY IF EXISTS rls_wa_messages_select_vendor ON wa_messages;
DROP POLICY IF EXISTS rls_wa_messages_insert_vendor ON wa_messages;
DROP POLICY IF EXISTS rls_wa_outbox_select_vendor ON wa_outbox;
DROP POLICY IF EXISTS rls_wa_outbox_insert_vendor ON wa_outbox;

-- =====================================================
-- Recreate policies using the SECURITY DEFINER function
-- =====================================================

-- wa_messages SELECT for vendors
CREATE POLICY rls_wa_messages_select_vendor ON wa_messages
  FOR SELECT USING (
    tenant_id = get_user_tenant_id()
    AND can_access_wa_conversation(conversation_id)
  );

-- wa_messages INSERT for vendors
CREATE POLICY rls_wa_messages_insert_vendor ON wa_messages
  FOR INSERT WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND can_access_wa_conversation(conversation_id)
  );

-- wa_outbox SELECT for vendors
CREATE POLICY rls_wa_outbox_select_vendor ON wa_outbox
  FOR SELECT USING (
    tenant_id = get_user_tenant_id()
    AND can_access_wa_conversation(conversation_id)
  );

-- wa_outbox INSERT for vendors
CREATE POLICY rls_wa_outbox_insert_vendor ON wa_outbox
  FOR INSERT WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND can_access_wa_conversation(conversation_id)
  );
