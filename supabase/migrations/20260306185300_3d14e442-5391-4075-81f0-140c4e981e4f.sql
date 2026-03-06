
-- =====================================================
-- STRUCTURAL BLINDAGE: wa_messages canonical columns + indexes
-- =====================================================

-- 1) Add correlation_id for outbound dedup reconciliation
ALTER TABLE public.wa_messages ADD COLUMN IF NOT EXISTS correlation_id uuid;

-- 2) Add formal media status columns
ALTER TABLE public.wa_messages ADD COLUMN IF NOT EXISTS media_status text DEFAULT 'none'
  CHECK (media_status IN ('none','pending','fetching','ready','failed'));
ALTER TABLE public.wa_messages ADD COLUMN IF NOT EXISTS media_error_message text;
ALTER TABLE public.wa_messages ADD COLUMN IF NOT EXISTS media_failed_at timestamptz;
ALTER TABLE public.wa_messages ADD COLUMN IF NOT EXISTS media_retry_count integer DEFAULT 0;
ALTER TABLE public.wa_messages ADD COLUMN IF NOT EXISTS storage_path text;
ALTER TABLE public.wa_messages ADD COLUMN IF NOT EXISTS file_name text;
ALTER TABLE public.wa_messages ADD COLUMN IF NOT EXISTS file_size bigint;

-- 3) Add status timestamp columns
ALTER TABLE public.wa_messages ADD COLUMN IF NOT EXISTS queued_at timestamptz;
ALTER TABLE public.wa_messages ADD COLUMN IF NOT EXISTS sent_at timestamptz;
ALTER TABLE public.wa_messages ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
ALTER TABLE public.wa_messages ADD COLUMN IF NOT EXISTS read_at timestamptz;
ALTER TABLE public.wa_messages ADD COLUMN IF NOT EXISTS failed_at timestamptz;

-- 4) Add error_code column
ALTER TABLE public.wa_messages ADD COLUMN IF NOT EXISTS error_code text;

-- 5) UNIQUE partial index on evolution_message_id (only when NOT NULL)
-- Prevents two rows for the same provider message
CREATE UNIQUE INDEX IF NOT EXISTS idx_wa_messages_evolution_msg_id_unique
  ON public.wa_messages (evolution_message_id)
  WHERE evolution_message_id IS NOT NULL;

-- 6) Index for correlation_id lookup (outbound reconciliation)
CREATE INDEX IF NOT EXISTS idx_wa_messages_correlation_id
  ON public.wa_messages (correlation_id)
  WHERE correlation_id IS NOT NULL;

-- 7) Composite index for timeline queries
CREATE INDEX IF NOT EXISTS idx_wa_messages_conv_created
  ON public.wa_messages (conversation_id, created_at DESC, id DESC);

-- 8) Index for tenant + remote_jid on conversations  
CREATE INDEX IF NOT EXISTS idx_wa_conversations_tenant_jid
  ON public.wa_conversations (tenant_id, remote_jid);

-- 9) Index for instance + remote_jid on conversations (used by webhook processor)
CREATE INDEX IF NOT EXISTS idx_wa_conversations_instance_jid
  ON public.wa_conversations (instance_id, remote_jid);

-- 10) Canonical JID normalizer function
CREATE OR REPLACE FUNCTION public.normalize_wa_jid(raw_jid text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  digits text;
  suffix text;
BEGIN
  IF raw_jid IS NULL OR raw_jid = '' THEN RETURN raw_jid; END IF;
  
  -- Groups: never normalize
  IF raw_jid LIKE '%@g.us' THEN RETURN raw_jid; END IF;
  
  -- Extract suffix
  IF raw_jid LIKE '%@s.whatsapp.net' THEN
    suffix := '@s.whatsapp.net';
  ELSIF raw_jid LIKE '%@c.us' THEN
    suffix := '@c.us';
  ELSE
    -- Raw phone number
    suffix := '@s.whatsapp.net';
  END IF;
  
  -- Extract digits only
  digits := regexp_replace(split_part(raw_jid, '@', 1), '[^0-9]', '', 'g');
  
  -- BR number normalization: always use 13-digit format (55 + 2 DDD + 9 + 8 digits)
  IF digits LIKE '55%' AND length(digits) = 12 THEN
    -- Missing 9th digit: 55 + DD + 8digits → 55 + DD + 9 + 8digits
    digits := substring(digits, 1, 4) || '9' || substring(digits, 5);
  END IF;
  
  RETURN digits || suffix;
END;
$$;

-- 11) Canonical conversation resolver function
CREATE OR REPLACE FUNCTION public.resolve_wa_conversation(
  p_instance_id uuid,
  p_remote_jid text
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  canonical_jid text;
  alt_jid text;
  conv_id uuid;
  digits text;
BEGIN
  canonical_jid := normalize_wa_jid(p_remote_jid);
  
  -- Try canonical first
  SELECT id INTO conv_id
  FROM wa_conversations
  WHERE instance_id = p_instance_id AND remote_jid = canonical_jid
  LIMIT 1;
  
  IF conv_id IS NOT NULL THEN RETURN conv_id; END IF;
  
  -- Try original JID
  SELECT id INTO conv_id
  FROM wa_conversations
  WHERE instance_id = p_instance_id AND remote_jid = p_remote_jid
  LIMIT 1;
  
  IF conv_id IS NOT NULL THEN RETURN conv_id; END IF;
  
  -- Try alternate BR format (without 9th digit)
  digits := regexp_replace(split_part(canonical_jid, '@', 1), '[^0-9]', '', 'g');
  IF digits LIKE '55%' AND length(digits) = 13 THEN
    alt_jid := substring(digits, 1, 4) || substring(digits, 6) || '@s.whatsapp.net';
    SELECT id INTO conv_id
    FROM wa_conversations
    WHERE instance_id = p_instance_id AND remote_jid = alt_jid
    LIMIT 1;
  END IF;
  
  RETURN conv_id;
END;
$$;
