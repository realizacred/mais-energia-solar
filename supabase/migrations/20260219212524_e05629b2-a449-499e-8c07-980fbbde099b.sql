
-- STEP 1: Backfill legacy items
UPDATE wa_outbox
SET idempotency_key = 'legacy:' || id::text
WHERE idempotency_key IS NULL;

-- STEP 2: Enforce NOT NULL
ALTER TABLE wa_outbox ALTER COLUMN idempotency_key SET NOT NULL;

-- STEP 3: Replace partial unique index with full unique index
DROP INDEX IF EXISTS idx_wa_outbox_idempotency;
CREATE UNIQUE INDEX idx_wa_outbox_tenant_idempotency ON wa_outbox(tenant_id, idempotency_key);

-- STEP 4: Drop existing function and recreate with hardened validation
DROP FUNCTION IF EXISTS enqueue_wa_outbox_item(uuid,uuid,text,text,text,text,uuid,uuid,timestamptz,text,text);

CREATE OR REPLACE FUNCTION enqueue_wa_outbox_item(
  p_tenant_id uuid,
  p_instance_id uuid,
  p_remote_jid text,
  p_message_type text,
  p_content text,
  p_media_url text DEFAULT NULL,
  p_conversation_id uuid DEFAULT NULL,
  p_message_id uuid DEFAULT NULL,
  p_scheduled_at timestamptz DEFAULT now(),
  p_idempotency_key text DEFAULT NULL,
  p_status text DEFAULT 'pending'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_canonical_jid text;
  v_item_id uuid;
  v_inst_tenant uuid;
BEGIN
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'idempotency_key is required';
  END IF;

  SELECT tenant_id INTO v_inst_tenant
  FROM wa_instances WHERE id = p_instance_id;

  IF v_inst_tenant IS NULL THEN
    RAISE EXCEPTION 'Instance % not found', p_instance_id;
  END IF;

  IF v_inst_tenant != p_tenant_id THEN
    RAISE EXCEPTION 'Instance % does not belong to tenant %', p_instance_id, p_tenant_id;
  END IF;

  v_canonical_jid := normalize_remote_jid(p_remote_jid);

  INSERT INTO wa_outbox (
    tenant_id, instance_id, remote_jid, remote_jid_canonical,
    message_type, content, media_url,
    conversation_id, message_id,
    scheduled_at, status, idempotency_key
  ) VALUES (
    p_tenant_id, p_instance_id, p_remote_jid, v_canonical_jid,
    p_message_type, p_content, p_media_url,
    p_conversation_id, p_message_id,
    p_scheduled_at, p_status, p_idempotency_key
  )
  ON CONFLICT (tenant_id, idempotency_key)
  DO NOTHING
  RETURNING id INTO v_item_id;

  RETURN v_item_id;
END;
$$;
