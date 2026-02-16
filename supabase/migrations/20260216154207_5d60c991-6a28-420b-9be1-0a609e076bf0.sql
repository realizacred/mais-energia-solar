
-- =====================================================
-- FULL GOOGLE CALENDAR / AGENDA CLEANUP
-- Drop all related tables, functions, and data
-- =====================================================

-- 1. Drop RPC functions created for google calendar admin
DROP FUNCTION IF EXISTS public.get_google_calendar_config_status(uuid);
DROP FUNCTION IF EXISTS public.get_google_calendar_config_status();
DROP FUNCTION IF EXISTS public.get_calendar_connected_users(uuid);
DROP FUNCTION IF EXISTS public.get_calendar_connected_users();

-- 2. Drop maintenance functions
DROP FUNCTION IF EXISTS public.cleanup_agenda_sync_logs();
DROP FUNCTION IF EXISTS public.cleanup_old_gcal_events();

-- 3. Delete google calendar entries from integration_configs
DELETE FROM integration_configs WHERE service_key IN (
  'google_calendar_client_id', 
  'google_calendar_client_secret'
);

-- 4. Drop tables (order matters for foreign keys)
DROP TABLE IF EXISTS public.agenda_sync_logs CASCADE;
DROP TABLE IF EXISTS public.google_calendar_events CASCADE;
DROP TABLE IF EXISTS public.google_calendar_tokens CASCADE;
DROP TABLE IF EXISTS public.agenda_config CASCADE;

-- 5. Remove google calendar columns from appointments table
ALTER TABLE public.appointments 
  DROP COLUMN IF EXISTS google_event_id,
  DROP COLUMN IF EXISTS google_sync_status,
  DROP COLUMN IF EXISTS google_sync_error,
  DROP COLUMN IF EXISTS google_synced_at;

-- 6. Drop enum if exists
DROP TYPE IF EXISTS public.gcal_sync_mode CASCADE;
