
-- ============================================================
-- FINAL HARDENING: Admin RPCs → service_role only
-- User RPC → authenticated only
-- ============================================================

-- 1. Admin RPCs: REVOKE from ALL app-level roles, keep service_role
REVOKE ALL ON FUNCTION public.get_google_calendar_config_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_google_calendar_config_status() FROM anon;
REVOKE ALL ON FUNCTION public.get_google_calendar_config_status() FROM authenticated;

REVOKE ALL ON FUNCTION public.get_calendar_connected_users() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_calendar_connected_users() FROM anon;
REVOKE ALL ON FUNCTION public.get_calendar_connected_users() FROM authenticated;

-- 2. User RPC: authenticated only (no anon)
REVOKE ALL ON FUNCTION public.get_my_calendar_token() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_calendar_token() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_calendar_token() TO authenticated;
