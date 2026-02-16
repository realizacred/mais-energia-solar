
-- Recreate RPCs to accept user_id parameter (called from trusted Edge Function gateway)
-- The Edge Function validates auth + admin before calling these

DROP FUNCTION IF EXISTS public.get_google_calendar_config_status();
CREATE OR REPLACE FUNCTION public.get_google_calendar_config_status(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_id_active boolean := false;
  v_secret_active boolean := false;
  v_masked text;
  v_raw_id text;
  v_id_updated timestamptz;
  v_secret_updated timestamptz;
  v_last_updated timestamptz;
BEGIN
  SELECT p.tenant_id INTO v_tenant_id FROM profiles p WHERE p.user_id = p_user_id LIMIT 1;
  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('hasClientId', false, 'hasClientSecret', false);
  END IF;

  SELECT is_active, updated_at, api_key INTO v_id_active, v_id_updated, v_raw_id
  FROM integration_configs
  WHERE tenant_id = v_tenant_id AND service_key = 'google_calendar_client_id'
  LIMIT 1;

  SELECT is_active, updated_at INTO v_secret_active, v_secret_updated
  FROM integration_configs
  WHERE tenant_id = v_tenant_id AND service_key = 'google_calendar_client_secret'
  LIMIT 1;

  IF v_raw_id IS NOT NULL AND length(v_raw_id) > 28 THEN
    v_masked := left(v_raw_id, 8) || '•••' || right(v_raw_id, 20);
  ELSIF v_raw_id IS NOT NULL THEN
    v_masked := '•••' || right(v_raw_id, 4);
  END IF;

  v_last_updated := GREATEST(v_id_updated, v_secret_updated);

  RETURN jsonb_build_object(
    'hasClientId', COALESCE(v_id_active, false),
    'hasClientSecret', COALESCE(v_secret_active, false),
    'maskedClientId', v_masked,
    'lastUpdated', v_last_updated
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_google_calendar_config_status(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_google_calendar_config_status(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_google_calendar_config_status(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_google_calendar_config_status(uuid) TO service_role;

-- Recreate connected_users with user_id parameter
DROP FUNCTION IF EXISTS public.get_calendar_connected_users();
CREATE OR REPLACE FUNCTION public.get_calendar_connected_users(p_user_id uuid)
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
  SELECT p.tenant_id INTO v_tenant_id FROM profiles p WHERE p.user_id = p_user_id LIMIT 1;
  IF v_tenant_id IS NULL THEN
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
  WHERE t.tenant_id = v_tenant_id AND t.is_active = true;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_calendar_connected_users(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_calendar_connected_users(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_calendar_connected_users(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_calendar_connected_users(uuid) TO service_role;
