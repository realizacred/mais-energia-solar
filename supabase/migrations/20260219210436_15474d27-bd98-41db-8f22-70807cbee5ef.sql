
-- ============================================================
-- P0 HARDENING: Scoped Locks, normalize_remote_jid, FKs, canonical JID
-- ============================================================

-- 1) normalize_remote_jid: canonical format
CREATE OR REPLACE FUNCTION public.normalize_remote_jid(raw_jid text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  digits text;
BEGIN
  IF raw_jid IS NULL OR raw_jid = '' THEN RETURN NULL; END IF;
  -- Strip suffix
  digits := replace(raw_jid, '@s.whatsapp.net', '');
  digits := replace(digits, '@c.us', '');
  -- Keep only digits
  digits := regexp_replace(digits, '[^0-9]', '', 'g');
  -- Brazilian normalization: add 9th digit if missing
  IF digits LIKE '55%' AND length(digits) = 12 THEN
    digits := substring(digits from 1 for 4) || '9' || substring(digits from 5);
  END IF;
  RETURN digits || '@s.whatsapp.net';
END;
$$;

-- 2) Add remote_jid_canonical column
ALTER TABLE public.wa_outbox 
  ADD COLUMN IF NOT EXISTS remote_jid_canonical text;

-- 3) Backfill remote_jid_canonical from existing remote_jid
UPDATE public.wa_outbox
SET remote_jid_canonical = normalize_remote_jid(remote_jid)
WHERE remote_jid_canonical IS NULL;

-- 4) Trigger to auto-set remote_jid_canonical on INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.trg_wa_outbox_set_canonical_jid()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.remote_jid_canonical := normalize_remote_jid(NEW.remote_jid);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wa_outbox_canonical_jid ON public.wa_outbox;
CREATE TRIGGER trg_wa_outbox_canonical_jid
  BEFORE INSERT OR UPDATE OF remote_jid ON public.wa_outbox
  FOR EACH ROW EXECUTE FUNCTION public.trg_wa_outbox_set_canonical_jid();

-- 5) Foreign key constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'wa_outbox_instance_id_fkey'
      AND table_name = 'wa_outbox'
  ) THEN
    ALTER TABLE public.wa_outbox
      ADD CONSTRAINT wa_outbox_instance_id_fkey
      FOREIGN KEY (instance_id) REFERENCES public.wa_instances(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'wa_outbox_tenant_id_fkey'
      AND table_name = 'wa_outbox'
  ) THEN
    ALTER TABLE public.wa_outbox
      ADD CONSTRAINT wa_outbox_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
  END IF;
END $$;

-- 6) Replace GLOBAL lock with SCOPED lock (per tenant+instance)
CREATE OR REPLACE FUNCTION public.try_outbox_lock(p_tenant_id uuid DEFAULT NULL, p_instance_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_tenant_id IS NOT NULL AND p_instance_id IS NOT NULL THEN
    RETURN pg_try_advisory_lock(hashtext(p_tenant_id::text || ':outbox:' || p_instance_id::text));
  ELSE
    -- Backward compat: global lock if no params
    RETURN pg_try_advisory_lock(hashtext('process-wa-outbox'));
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_outbox_lock(p_tenant_id uuid DEFAULT NULL, p_instance_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_tenant_id IS NOT NULL AND p_instance_id IS NOT NULL THEN
    PERFORM pg_advisory_unlock(hashtext(p_tenant_id::text || ':outbox:' || p_instance_id::text));
  ELSE
    PERFORM pg_advisory_unlock(hashtext('process-wa-outbox'));
  END IF;
END;
$$;

-- 7) Index for per-instance pending queries
CREATE INDEX IF NOT EXISTS idx_wa_outbox_instance_pending
  ON public.wa_outbox (instance_id, status, scheduled_at)
  WHERE status = 'pending';
