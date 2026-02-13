
-- ══════════════════════════════════════════════════════════════
-- 1) Composite indices for appointments performance
-- ══════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_appointments_assigned_starts
  ON appointments (tenant_id, assigned_to, starts_at);

CREATE INDEX IF NOT EXISTS idx_appointments_status_starts
  ON appointments (tenant_id, status, starts_at);

CREATE INDEX IF NOT EXISTS idx_appointments_reminder
  ON appointments (tenant_id, status, reminder_sent, starts_at)
  WHERE status = 'scheduled' AND reminder_sent = false;

-- Index on agenda_sync_logs for cleanup
CREATE INDEX IF NOT EXISTS idx_agenda_sync_logs_created
  ON agenda_sync_logs (created_at);

-- ══════════════════════════════════════════════════════════════
-- 2) Function: auto-transition scheduled → missed
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.auto_mark_missed_appointments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE appointments
  SET status = 'missed',
      updated_at = now()
  WHERE status = 'scheduled'
    AND ends_at IS NOT NULL
    AND ends_at < now() - interval '30 minutes';

  -- Also handle appointments without ends_at (use starts_at + 1 hour)
  UPDATE appointments
  SET status = 'missed',
      updated_at = now()
  WHERE status = 'scheduled'
    AND ends_at IS NULL
    AND starts_at < now() - interval '90 minutes';
END;
$$;

-- ══════════════════════════════════════════════════════════════
-- 3) Function: get appointments pending reminders
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_pending_appointment_reminders()
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  assigned_to uuid,
  title text,
  starts_at timestamptz,
  reminder_minutes integer,
  appointment_type appointment_type,
  cliente_id uuid,
  lead_id uuid,
  conversation_id uuid
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT a.id, a.tenant_id, a.assigned_to, a.title, a.starts_at,
         a.reminder_minutes, a.appointment_type, a.cliente_id, a.lead_id, a.conversation_id
  FROM appointments a
  WHERE a.status = 'scheduled'
    AND a.reminder_sent = false
    AND a.reminder_minutes > 0
    AND a.starts_at <= now() + (a.reminder_minutes || ' minutes')::interval
    AND a.starts_at > now();
$$;
