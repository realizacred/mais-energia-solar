
-- RPC: Per-user unread conversations for notification badge
-- Uses wa_reads (per-user read state) instead of global unread_count
-- Respects visibility: admin sees all, vendor sees assigned + unassigned on their instances

CREATE OR REPLACE FUNCTION public.get_user_unread_conversations(
  _limit integer DEFAULT 50
)
RETURNS TABLE(
  conversation_id uuid,
  cliente_nome text,
  cliente_telefone text,
  last_message_preview text,
  last_message_at timestamptz,
  unread_for_user integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid;
  _tenant_id uuid;
  _is_admin boolean;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RETURN;
  END IF;

  _tenant_id := get_user_tenant_id(_user_id);
  IF _tenant_id IS NULL THEN
    RETURN;
  END IF;

  _is_admin := is_admin(_user_id);

  RETURN QUERY
  SELECT
    c.id AS conversation_id,
    c.cliente_nome,
    c.cliente_telefone,
    c.last_message_preview,
    c.last_message_at,
    -- Count messages after user's last read
    COALESCE(msg_counts.cnt, 0)::integer AS unread_for_user
  FROM wa_conversations c
  LEFT JOIN wa_reads wr
    ON wr.conversation_id = c.id AND wr.user_id = _user_id
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::integer AS cnt
    FROM wa_messages m
    WHERE m.conversation_id = c.id
      AND m.direction = 'in'
      AND m.is_internal_note = false
      AND (wr.last_read_at IS NULL OR m.created_at > wr.last_read_at)
  ) msg_counts ON true
  WHERE c.tenant_id = _tenant_id
    AND c.is_group = false
    AND COALESCE(msg_counts.cnt, 0) > 0
    -- Visibility rules
    AND (
      _is_admin
      OR c.assigned_to = _user_id
      OR (
        c.assigned_to IS NULL
        AND EXISTS (
          SELECT 1 FROM wa_instances wi
          WHERE wi.id = c.instance_id
            AND wi.tenant_id = _tenant_id
            AND (
              wi.owner_user_id = _user_id
              OR EXISTS (
                SELECT 1 FROM wa_instance_consultores wic
                JOIN consultores v ON v.id = wic.consultor_id
                WHERE wic.instance_id = wi.id
                  AND v.user_id = _user_id
                  AND v.ativo = true
              )
            )
        )
      )
    )
  ORDER BY c.last_message_at DESC NULLS LAST
  LIMIT _limit;
END;
$$;
