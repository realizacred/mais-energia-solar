-- Add media_filename column to wa_outbox
ALTER TABLE public.wa_outbox ADD COLUMN IF NOT EXISTS media_filename text;

-- Update the enqueue_wa_outbox_item function to accept media_filename
CREATE OR REPLACE FUNCTION public.enqueue_wa_outbox_item(
  p_tenant_id uuid,
  p_instance_id uuid,
  p_remote_jid text,
  p_message_type text,
  p_content text,
  p_media_url text DEFAULT NULL,
  p_media_filename text DEFAULT NULL,
  p_conversation_id uuid DEFAULT NULL,
  p_message_id uuid DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_scheduled_at timestamptz DEFAULT now(),
  p_status text DEFAULT 'pending'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_canonical text;
BEGIN
  v_canonical := normalize_wa_jid(p_remote_jid);

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_id
    FROM wa_outbox
    WHERE idempotency_key = p_idempotency_key
    LIMIT 1;
    IF v_id IS NOT NULL THEN
      RETURN v_id;
    END IF;
  END IF;

  INSERT INTO wa_outbox (
    tenant_id, instance_id, remote_jid, remote_jid_canonical,
    message_type, content, media_url, media_filename,
    conversation_id, message_id, idempotency_key,
    scheduled_at, status
  ) VALUES (
    p_tenant_id, p_instance_id, p_remote_jid, v_canonical,
    p_message_type, p_content, p_media_url, p_media_filename,
    p_conversation_id, p_message_id,
    COALESCE(p_idempotency_key, gen_random_uuid()::text),
    COALESCE(p_scheduled_at, now()), COALESCE(p_status, 'pending')
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;