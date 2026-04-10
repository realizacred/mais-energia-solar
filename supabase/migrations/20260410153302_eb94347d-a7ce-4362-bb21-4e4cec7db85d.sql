-- Fix: consultant loses message access immediately when conversation is transferred.
-- Add wa_transfers history check so previous owners retain read access.

DROP POLICY IF EXISTS "rls_wa_messages_select_vendor" ON public.wa_messages;

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
        -- Current assignee
        wc.assigned_to = auth.uid()
        -- Previous assignee (transfer history)
        OR EXISTS (
          SELECT 1 FROM wa_transfers wt
          WHERE wt.conversation_id = wc.id
            AND wt.from_user_id = auth.uid()
        )
        -- Unassigned conversation on consultant's instance
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