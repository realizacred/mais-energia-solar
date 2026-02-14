
CREATE OR REPLACE FUNCTION public.get_super_admin_tenant_detail(_tenant_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _result json;
BEGIN
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden: super_admin required' USING ERRCODE = 'P0403';
  END IF;

  SELECT json_build_object(
    'tenant', row_to_json(t),
    'owner_email', (SELECT au.email FROM auth.users au WHERE au.id = t.owner_user_id),
    'metrics', json_build_object(
      'leads_count', (SELECT COUNT(*)::int FROM leads WHERE tenant_id = _tenant_id),
      'clientes_count', (SELECT COUNT(*)::int FROM clientes WHERE tenant_id = _tenant_id),
      'users_count', (SELECT COUNT(*)::int FROM profiles WHERE tenant_id = _tenant_id),
      'projetos_count', (SELECT COUNT(*)::int FROM projetos WHERE tenant_id = _tenant_id),
      'wa_instances_count', (SELECT COUNT(*)::int FROM wa_instances WHERE tenant_id = _tenant_id),
      'conversas_count', (SELECT COUNT(*)::int FROM wa_conversations WHERE tenant_id = _tenant_id)
    ),
    'subscription', (
      SELECT row_to_json(sq) FROM (
        SELECT s.id, s.status, s.trial_ends_at, s.current_period_start, s.current_period_end,
               s.cancel_at_period_end, p.code AS plan_code, p.name AS plan_name, p.price_monthly
        FROM subscriptions s
        JOIN plans p ON p.id = s.plan_id
        WHERE s.tenant_id = _tenant_id
        LIMIT 1
      ) sq
    ),
    'integration_health', (
      SELECT COALESCE(json_agg(row_to_json(ih)), '[]'::json)
      FROM (
        SELECT integration_name, status, last_check_at, error_message, details
        FROM integration_health_cache
        WHERE tenant_id = _tenant_id
        ORDER BY integration_name
      ) ih
    ),
    'recent_audit', (
      SELECT COALESCE(json_agg(row_to_json(al)), '[]'::json)
      FROM (
        SELECT id, action, target_user_id, details, created_at, ip_address
        FROM super_admin_actions
        WHERE target_tenant_id = _tenant_id
        ORDER BY created_at DESC
        LIMIT 20
      ) al
    ),
    'users', (
      SELECT COALESCE(json_agg(row_to_json(uq)), '[]'::json)
      FROM (
        SELECT p.user_id, p.nome, au.email, p.telefone, p.ativo, p.created_at,
          (SELECT COALESCE(json_agg(ur.role), '[]'::json) FROM user_roles ur WHERE ur.user_id = p.user_id) AS roles
        FROM profiles p
        LEFT JOIN auth.users au ON au.id = p.user_id
        WHERE p.tenant_id = _tenant_id
        ORDER BY p.created_at ASC
      ) uq
    )
  ) INTO _result
  FROM tenants t
  WHERE t.id = _tenant_id;

  IF _result IS NULL THEN
    RAISE EXCEPTION 'Tenant not found' USING ERRCODE = 'P0404';
  END IF;

  RETURN _result;
END;
$function$;
