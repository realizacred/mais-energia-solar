
DROP FUNCTION IF EXISTS public.get_calendar_connected_users();

CREATE OR REPLACE FUNCTION public.get_calendar_connected_users()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_result jsonb;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM profiles
  WHERE id = auth.uid();

  IF v_tenant_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', t.user_id,
    'email', t.email,
    'connected_at', t.created_at
  )), '[]'::jsonb)
  INTO v_result
  FROM google_calendar_tokens t
  WHERE t.tenant_id = v_tenant_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_calendar_connected_users() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_calendar_connected_users() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_calendar_connected_users() TO service_role;
