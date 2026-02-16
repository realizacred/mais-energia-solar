
-- ============================================================
-- SECURITY HARDENING: Replace direct SELECT with safe RPCs
-- ============================================================

-- 1. RPC: User reads own calendar status (SAFE columns only)
CREATE OR REPLACE FUNCTION public.get_my_calendar_token()
RETURNS TABLE (
  id uuid,
  google_email text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  last_synced_at timestamptz,
  token_expires_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.google_email, t.is_active, t.created_at, t.updated_at, t.last_synced_at, t.token_expires_at
  FROM public.google_calendar_tokens t
  WHERE t.user_id = auth.uid()
    AND t.tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1)
  LIMIT 1;
$$;

-- 2. RPC: Admin lists connected users in tenant (SAFE columns only)
CREATE OR REPLACE FUNCTION public.get_calendar_connected_users()
RETURNS TABLE (
  user_id uuid,
  google_email text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.user_id, t.google_email, t.is_active, t.created_at, t.updated_at
  FROM public.google_calendar_tokens t
  WHERE t.tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1)
    AND public.is_admin(auth.uid());
$$;

-- 3. RPC: Admin reads Google Calendar config status (NO secrets returned)
CREATE OR REPLACE FUNCTION public.get_google_calendar_config_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant_id uuid;
  _id_active boolean := false;
  _secret_active boolean := false;
  _masked text;
  _last_updated timestamptz;
  _id_updated timestamptz;
  _secret_updated timestamptz;
  _raw_id text;
BEGIN
  SELECT p.tenant_id INTO _tenant_id FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1;
  IF _tenant_id IS NULL THEN RETURN jsonb_build_object('hasClientId', false, 'hasClientSecret', false); END IF;
  IF NOT public.is_admin(auth.uid()) THEN RETURN jsonb_build_object('hasClientId', false, 'hasClientSecret', false); END IF;

  SELECT is_active, updated_at, api_key INTO _id_active, _id_updated, _raw_id
  FROM public.integration_configs
  WHERE tenant_id = _tenant_id AND service_key = 'google_calendar_client_id'
  LIMIT 1;

  SELECT is_active, updated_at INTO _secret_active, _secret_updated
  FROM public.integration_configs
  WHERE tenant_id = _tenant_id AND service_key = 'google_calendar_client_secret'
  LIMIT 1;

  IF _raw_id IS NOT NULL AND length(_raw_id) > 28 THEN
    _masked := left(_raw_id, 8) || '•••' || right(_raw_id, 20);
  ELSIF _raw_id IS NOT NULL THEN
    _masked := '•••' || right(_raw_id, 4);
  END IF;

  _last_updated := GREATEST(_id_updated, _secret_updated);

  RETURN jsonb_build_object(
    'hasClientId', COALESCE(_id_active, false),
    'hasClientSecret', COALESCE(_secret_active, false),
    'maskedClientId', _masked,
    'lastUpdated', _last_updated
  );
END;
$$;

-- 4. DROP user-facing SELECT policies on google_calendar_tokens
-- Tokens are now ONLY accessible via service_role (Edge Functions) and RPCs
DROP POLICY IF EXISTS "Users can view own tokens" ON public.google_calendar_tokens;
DROP POLICY IF EXISTS "Admins can view tenant tokens" ON public.google_calendar_tokens;
