
-- Make all advisory unlock functions defensive: only unlock if we actually own the lock
-- This eliminates the "you don't own a lock of type ExclusiveLock" warnings

CREATE OR REPLACE FUNCTION public.release_webhook_lock()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only release if we actually hold this lock
  IF EXISTS (
    SELECT 1 FROM pg_locks
    WHERE locktype = 'advisory'
      AND classid = hashtext('process-webhook-events')::int
      AND objid = 0
      AND pid = pg_backend_pid()
  ) THEN
    PERFORM pg_advisory_unlock(hashtext('process-webhook-events'));
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_followup_lock()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_locks
    WHERE locktype = 'advisory'
      AND classid = hashtext('process-wa-followups')::int
      AND objid = 0
      AND pid = pg_backend_pid()
  ) THEN
    PERFORM pg_advisory_unlock(hashtext('process-wa-followups'));
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_outbox_lock(p_tenant_id uuid DEFAULT NULL, p_instance_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lock_key int;
BEGIN
  IF p_tenant_id IS NOT NULL AND p_instance_id IS NOT NULL THEN
    lock_key := hashtext(p_tenant_id::text || ':outbox:' || p_instance_id::text);
  ELSE
    lock_key := hashtext('process-wa-outbox');
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_locks
    WHERE locktype = 'advisory'
      AND classid = lock_key
      AND objid = 0
      AND pid = pg_backend_pid()
  ) THEN
    PERFORM pg_advisory_unlock(lock_key);
  END IF;
END;
$$;
