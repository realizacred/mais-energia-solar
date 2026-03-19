-- Fix: wa_messages SELECT policy is more restrictive than wa_conversations,
-- causing "Nenhuma mensagem ainda" even when conversations are visible.
-- Align wa_messages vendor SELECT with wa_conversations vendor SELECT logic.

-- Drop the restrictive vendor SELECT policy
DROP POLICY IF EXISTS "rls_wa_messages_select_vendor" ON public.wa_messages;

-- Create aligned policy: same logic as wa_conversations_select_vendor
-- Non-admin users see messages if they can see the conversation
CREATE POLICY "rls_wa_messages_select_vendor"
ON public.wa_messages
FOR SELECT
TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  AND NOT is_admin(auth.uid())
  AND EXISTS (
    SELECT 1 FROM wa_conversations wc
    LEFT JOIN wa_instances wi ON wi.id = wc.instance_id
    WHERE wc.id = wa_messages.conversation_id
      AND wc.tenant_id = get_user_tenant_id()
      AND (
        wc.assigned_to = auth.uid()
        OR (
          wc.assigned_to IS NULL
          AND (
            wi.owner_user_id = auth.uid()
            OR EXISTS (
              SELECT 1
              FROM wa_instance_consultores wiv
              JOIN consultores v ON v.id = wiv.consultor_id
              WHERE wiv.instance_id = wi.id
                AND v.user_id = auth.uid()
                AND v.ativo = true
            )
          )
        )
      )
  )
);