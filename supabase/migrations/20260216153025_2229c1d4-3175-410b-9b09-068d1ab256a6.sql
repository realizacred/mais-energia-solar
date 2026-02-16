
-- Fix get_calendar_connected_users: wrong column name (email -> google_email) + fix grants
DROP FUNCTION IF EXISTS public.get_calendar_connected_users();

CREATE OR REPLACE FUNCTION public.get_calendar_connected_users()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_result jsonb;
BEGIN
  -- Derive tenant from caller
  SELECT p.tenant_id INTO v_tenant_id
  FROM profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  -- Admin check
  IF NOT is_admin(auth.uid()) THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', t.user_id,
    'email', t.google_email,
    'calendar_id', t.calendar_id,
    'is_active', t.is_active,
    'connected_at', t.created_at,
    'last_synced_at', t.last_synced_at
  )), '[]'::jsonb)
  INTO v_result
  FROM google_calendar_tokens t
  WHERE t.tenant_id = v_tenant_id
    AND t.is_active = true;

  RETURN v_result;
END;
$$;

-- Strict grants: ONLY service_role
REVOKE ALL ON FUNCTION public.get_calendar_connected_users() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_calendar_connected_users() FROM anon;
REVOKE ALL ON FUNCTION public.get_calendar_connected_users() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_calendar_connected_users() TO service_role;

-- Also fix grants on get_google_calendar_config_status (ensure no anon access)
REVOKE ALL ON FUNCTION public.get_google_calendar_config_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_google_calendar_config_status() FROM anon;
REVOKE ALL ON FUNCTION public.get_google_calendar_config_status() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_google_calendar_config_status() TO service_role;
