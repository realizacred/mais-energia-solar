-- Function to detect duplicate conversations (same instance + phone, different JID)
CREATE OR REPLACE FUNCTION public.check_wa_duplicate_conversations()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object('count', COALESCE(sum(cnt - 1), 0))
  FROM (
    SELECT instance_id, cliente_telefone, count(*) as cnt
    FROM wa_conversations
    WHERE cliente_telefone IS NOT NULL
      AND cliente_telefone != ''
    GROUP BY instance_id, cliente_telefone
    HAVING count(*) > 1
  ) dupes;
$$;

-- Function to detect orphan messages
CREATE OR REPLACE FUNCTION public.check_wa_orphan_messages()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object('count', count(*))
  FROM wa_messages m
  WHERE NOT EXISTS (
    SELECT 1 FROM wa_conversations c WHERE c.id = m.conversation_id
  );
$$;