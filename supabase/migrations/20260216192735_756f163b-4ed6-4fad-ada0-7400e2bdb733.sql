
-- ============================================================
-- CALENDAR HUB: Schema Evolution + Anti-Duplication + Sync Queue
-- ============================================================

-- 1) Add sync columns to appointments
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS external_provider text,
  ADD COLUMN IF NOT EXISTS external_calendar_id text,
  ADD COLUMN IF NOT EXISTS external_event_id text,
  ADD COLUMN IF NOT EXISTS external_etag text,
  ADD COLUMN IF NOT EXISTS external_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS sync_status text NOT NULL DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS sync_error text,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

-- 2) Anti-duplication: unique on external event per tenant+provider
CREATE UNIQUE INDEX IF NOT EXISTS uq_appointments_external_event
  ON public.appointments(tenant_id, external_provider, external_event_id)
  WHERE external_event_id IS NOT NULL;

-- 3) Anti-duplication: unique idempotency key per tenant
CREATE UNIQUE INDEX IF NOT EXISTS uq_appointments_idempotency
  ON public.appointments(tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 4) Index for sync worker queries
CREATE INDEX IF NOT EXISTS idx_appointments_sync_status
  ON public.appointments(tenant_id, sync_status)
  WHERE sync_status IN ('pending', 'error');

-- 5) Calendar sync queue table
CREATE TABLE IF NOT EXISTS public.calendar_sync_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  operation text NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
  payload_json jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'error', 'dead')),
  retry_count integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 5,
  next_retry_at timestamptz DEFAULT now(),
  locked_at timestamptz,
  locked_by text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.calendar_sync_queue ENABLE ROW LEVEL SECURITY;

-- RLS: only service_role can operate on sync queue (worker runs as service_role)
CREATE POLICY "calendar_sync_queue_service_all"
  ON public.calendar_sync_queue FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Authenticated can read their tenant's queue for monitoring
CREATE POLICY "calendar_sync_queue_tenant_select"
  ON public.calendar_sync_queue FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

-- Indexes for worker performance
CREATE INDEX IF NOT EXISTS idx_csq_pending
  ON public.calendar_sync_queue(status, next_retry_at)
  WHERE status IN ('pending', 'error');

CREATE INDEX IF NOT EXISTS idx_csq_tenant
  ON public.calendar_sync_queue(tenant_id);

CREATE INDEX IF NOT EXISTS idx_csq_appointment
  ON public.calendar_sync_queue(appointment_id);

-- 6) Advisory lock function for conversation-scoped operations
CREATE OR REPLACE FUNCTION public.acquire_conversation_lock(_conversation_id uuid)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  RETURN pg_try_advisory_xact_lock(hashtext(_conversation_id::text));
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_conversation_lock(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.acquire_conversation_lock(uuid) TO authenticated, service_role;

-- 7) Idempotent appointment creation function
CREATE OR REPLACE FUNCTION public.create_appointment_idempotent(
  _tenant_id uuid,
  _idempotency_key text,
  _title text,
  _starts_at timestamptz,
  _ends_at timestamptz DEFAULT NULL,
  _appointment_type appointment_type DEFAULT 'other',
  _assigned_to uuid DEFAULT NULL,
  _created_by uuid DEFAULT NULL,
  _conversation_id uuid DEFAULT NULL,
  _lead_id uuid DEFAULT NULL,
  _cliente_id uuid DEFAULT NULL,
  _description text DEFAULT NULL,
  _all_day boolean DEFAULT false,
  _reminder_minutes integer DEFAULT 30
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  _existing_id uuid;
  _new_id uuid;
BEGIN
  -- Check for existing appointment with same idempotency key
  SELECT id INTO _existing_id
  FROM appointments
  WHERE tenant_id = _tenant_id
    AND idempotency_key = _idempotency_key;

  IF _existing_id IS NOT NULL THEN
    RETURN _existing_id;
  END IF;

  -- Create new appointment
  INSERT INTO appointments (
    tenant_id, idempotency_key, title, starts_at, ends_at,
    appointment_type, assigned_to, created_by, conversation_id,
    lead_id, cliente_id, description, all_day, reminder_minutes
  ) VALUES (
    _tenant_id, _idempotency_key, _title, _starts_at, _ends_at,
    _appointment_type, _assigned_to, _created_by, _conversation_id,
    _lead_id, _cliente_id, _description, _all_day, _reminder_minutes
  )
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_appointment_idempotent FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_appointment_idempotent TO authenticated, service_role;

-- 8) Auto-enqueue trigger: when appointment changes, queue sync
CREATE OR REPLACE FUNCTION public.enqueue_calendar_sync()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  _op text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Only enqueue if it was synced to external calendar
    IF OLD.external_event_id IS NOT NULL THEN
      INSERT INTO calendar_sync_queue (tenant_id, appointment_id, operation, payload_json)
      VALUES (OLD.tenant_id, OLD.id, 'delete', jsonb_build_object(
        'external_event_id', OLD.external_event_id,
        'external_calendar_id', OLD.external_calendar_id,
        'external_provider', OLD.external_provider
      ));
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    _op := 'create';
  ELSE
    _op := 'update';
  END IF;

  -- Only enqueue if tenant has Google Calendar connected
  IF EXISTS (
    SELECT 1 FROM integrations
    WHERE tenant_id = NEW.tenant_id
      AND provider = 'google_calendar'
      AND status = 'connected'
  ) THEN
    INSERT INTO calendar_sync_queue (tenant_id, appointment_id, operation)
    VALUES (NEW.tenant_id, NEW.id, _op)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger
DROP TRIGGER IF EXISTS trg_enqueue_calendar_sync ON public.appointments;
CREATE TRIGGER trg_enqueue_calendar_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_calendar_sync();
