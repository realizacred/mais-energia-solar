
-- ============================================================
-- P0++ FINAL HARDENING: Canonical Enqueue, BR E.164, Delivery Lifecycle
-- ============================================================

-- 1) Fix normalize_remote_jid: enforce 55 for BR numbers
CREATE OR REPLACE FUNCTION public.normalize_remote_jid(raw_jid text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  digits text;
BEGIN
  IF raw_jid IS NULL OR raw_jid = '' THEN RETURN NULL; END IF;
  -- Strip suffixes
  digits := replace(raw_jid, '@s.whatsapp.net', '');
  digits := replace(digits, '@c.us', '');
  -- Keep only digits
  digits := regexp_replace(digits, '[^0-9]', '', 'g');
  -- Ensure BR country code (55) — system is BR-only
  IF NOT digits LIKE '55%' THEN
    digits := '55' || digits;
  END IF;
  -- Add 9th digit if missing (55 + 2-digit DDD + 8 digits = 12 total with 55)
  IF length(digits) = 12 THEN
    digits := substring(digits from 1 for 4) || '9' || substring(digits from 5);
  END IF;
  RETURN digits || '@s.whatsapp.net';
END;
$$;

-- 2) Backfill remote_jid_canonical with fixed function
UPDATE public.wa_outbox
SET remote_jid_canonical = normalize_remote_jid(remote_jid);

-- 3) Add delivery lifecycle columns to wa_outbox
ALTER TABLE public.wa_outbox
  ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

COMMENT ON COLUMN public.wa_outbox.delivery_status IS 'pending → sending → sent_ack → delivered → read → failed';

-- 4) Canonical enqueue RPC — SINGLE entry point for wa_outbox
CREATE OR REPLACE FUNCTION public.enqueue_wa_outbox_item(
  p_tenant_id uuid,
  p_instance_id uuid,
  p_remote_jid text,
  p_message_type text DEFAULT 'text',
  p_content text DEFAULT NULL,
  p_media_url text DEFAULT NULL,
  p_conversation_id uuid DEFAULT NULL,
  p_message_id uuid DEFAULT NULL,
  p_scheduled_at timestamptz DEFAULT now(),
  p_idempotency_key text DEFAULT NULL,
  p_status text DEFAULT 'pending'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_canonical_jid text;
  v_item_id uuid;
BEGIN
  -- Validate tenant exists
  IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = p_tenant_id) THEN
    RAISE EXCEPTION 'Invalid tenant_id: %', p_tenant_id;
  END IF;

  -- Validate instance belongs to tenant
  IF NOT EXISTS (
    SELECT 1 FROM wa_instances 
    WHERE id = p_instance_id AND tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'Instance % does not belong to tenant %', p_instance_id, p_tenant_id;
  END IF;

  -- Canonicalize remote_jid
  v_canonical_jid := normalize_remote_jid(p_remote_jid);
  IF v_canonical_jid IS NULL THEN
    RAISE EXCEPTION 'Invalid remote_jid: %', p_remote_jid;
  END IF;

  -- Upsert with idempotency
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
  WHERE idempotency_key IS NOT NULL
  DO NOTHING
  RETURNING id INTO v_item_id;

  RETURN v_item_id; -- NULL if idempotency conflict (duplicate)
END;
$$;

-- Grant execute to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.enqueue_wa_outbox_item TO authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_wa_outbox_item TO service_role;

-- 5) Fix search_path on normalize_br_phone and trigger
CREATE OR REPLACE FUNCTION public.normalize_br_phone(phone text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  digits text;
BEGIN
  IF phone IS NULL THEN RETURN NULL; END IF;
  digits := regexp_replace(phone, '[^0-9]', '', 'g');
  digits := replace(digits, 's', '');
  IF digits LIKE '55%' AND length(digits) = 12 THEN
    digits := substring(digits from 1 for 4) || '9' || substring(digits from 5);
  END IF;
  RETURN digits;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_wa_outbox_set_canonical_jid()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.remote_jid_canonical := normalize_remote_jid(NEW.remote_jid);
  RETURN NEW;
END;
$$;
