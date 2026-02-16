
-- ============================================================
-- SECURITY HARDENING: Least-privilege grants on Google Calendar RPCs
-- ============================================================

-- 1. Revoke PUBLIC (includes anon) from all 3 functions
REVOKE ALL ON FUNCTION public.get_my_calendar_token() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_calendar_connected_users() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_google_calendar_config_status() FROM PUBLIC;

-- 2. Grant EXECUTE only to authenticated role
GRANT EXECUTE ON FUNCTION public.get_my_calendar_token() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_calendar_connected_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_google_calendar_config_status() TO authenticated;
