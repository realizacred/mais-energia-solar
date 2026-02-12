
-- ============================================================
-- HARDENING: google_calendar_events
-- ============================================================

-- 1. Add missing columns for anti-loop and observability
ALTER TABLE public.google_calendar_events
ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'google'
  CHECK (source IN ('google', 'crm')),
ADD COLUMN IF NOT EXISTS is_all_day BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS google_updated_at TIMESTAMPTZ;

-- 2. Add UNIQUE constraint (required for upsert correctness)
-- Drop the plain index first, then create unique constraint
DROP INDEX IF EXISTS idx_gcal_events_google_id;
ALTER TABLE public.google_calendar_events
ADD CONSTRAINT uq_gcal_user_event UNIQUE (user_id, google_event_id);

-- 3. Add tenant_id index for RLS performance
CREATE INDEX IF NOT EXISTS idx_gcal_events_tenant ON public.google_calendar_events (tenant_id);

-- 4. Add index for retention cleanup
CREATE INDEX IF NOT EXISTS idx_gcal_events_end_at ON public.google_calendar_events (end_at)
WHERE end_at IS NOT NULL;

-- ============================================================
-- FIX RLS: Remove conflicting policies, create clean set
-- ============================================================

-- Drop ALL existing policies on google_calendar_events
DROP POLICY IF EXISTS "Users can view own calendar events" ON public.google_calendar_events;
DROP POLICY IF EXISTS "Service role manages calendar events" ON public.google_calendar_events;
DROP POLICY IF EXISTS "Service role inserts calendar events" ON public.google_calendar_events;
DROP POLICY IF EXISTS "Service role updates calendar events" ON public.google_calendar_events;
DROP POLICY IF EXISTS "Service role deletes calendar events" ON public.google_calendar_events;

-- Clean RLS: users see only their own events within their tenant
CREATE POLICY "gcal_events_select_own"
ON public.google_calendar_events FOR SELECT
TO authenticated
USING (auth.uid() = user_id AND tenant_id = get_user_tenant_id());

-- Only service_role can INSERT/UPDATE/DELETE (edge functions)
-- No authenticated user policy for writes — all writes go through edge functions
CREATE POLICY "gcal_events_insert_service"
ON public.google_calendar_events FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "gcal_events_update_service"
ON public.google_calendar_events FOR UPDATE
TO service_role
USING (true);

CREATE POLICY "gcal_events_delete_service"
ON public.google_calendar_events FOR DELETE
TO service_role
USING (true);

-- ============================================================
-- RETENTION: Cleanup function for old events (called by pg_cron)
-- ============================================================
CREATE OR REPLACE FUNCTION public.cleanup_old_gcal_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM google_calendar_events
  WHERE end_at IS NOT NULL AND end_at < now() - interval '90 days';
  
  -- Also clean events without end_at that started 90+ days ago
  DELETE FROM google_calendar_events
  WHERE end_at IS NULL AND start_at < now() - interval '90 days';
END;
$$;
