
-- Fix corrupted messages: text with null content
UPDATE wa_messages
SET content = '[mensagem não disponível]'
WHERE content IS NULL
  AND message_type = 'text';

-- Fix corrupted messages: media with null content and no URL
UPDATE wa_messages
SET content = '[mídia não disponível]'
WHERE content IS NULL
  AND media_url IS NULL
  AND message_type IN ('audio', 'image', 'video', 'document');

-- Security definer function to check if user sent messages in a conversation
-- Avoids infinite recursion when used inside RLS policy on wa_messages
CREATE OR REPLACE FUNCTION public.user_sent_in_conversation(_user_id uuid, _conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM wa_messages
    WHERE conversation_id = _conversation_id
      AND sent_by_user_id = _user_id
    LIMIT 1
  )
$$;

-- Drop and recreate the vendor SELECT policy to include participation check
DROP POLICY IF EXISTS rls_wa_messages_select_vendor ON wa_messages;

CREATE POLICY rls_wa_messages_select_vendor ON wa_messages
FOR SELECT TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  AND NOT is_admin(auth.uid())
  AND EXISTS (
    SELECT 1
    FROM wa_conversations wc
    LEFT JOIN wa_instances wi ON wi.id = wc.instance_id
    WHERE wc.id = wa_messages.conversation_id
      AND wc.tenant_id = get_user_tenant_id()
      AND (
        wc.assigned_to = auth.uid()
        OR EXISTS (
          SELECT 1 FROM wa_transfers wt
          WHERE wt.conversation_id = wc.id
            AND wt.from_user_id = auth.uid()
        )
        OR public.user_sent_in_conversation(auth.uid(), wc.id)
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
