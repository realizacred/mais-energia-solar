
-- ============================================================
-- PHASE 2: Super Admin Console + Tenant/User Admin
-- ============================================================

-- 1) Add missing columns to tenants
ALTER TABLE public.tenants 
  ADD COLUMN IF NOT EXISTS documento text,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS deleted_reason text;

-- Index for tenant list filters (btree, no trigram)
CREATE INDEX IF NOT EXISTS idx_tenants_status_deleted ON public.tenants (status, deleted_at);

-- 2) Enhance get_super_admin_metrics with search and pagination
CREATE OR REPLACE FUNCTION public.get_super_admin_metrics(
  _status_filter text DEFAULT NULL,
  _search text DEFAULT NULL,
  _offset integer DEFAULT 0,
  _limit integer DEFAULT 50
)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  _result json;
BEGIN
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden: super_admin required' USING ERRCODE = 'P0403';
  END IF;

  SELECT json_build_object(
    'totals', (
      SELECT json_build_object(
        'total_tenants', COUNT(*),
        'active_tenants', COUNT(*) FILTER (WHERE t.status = 'active'),
        'suspended_tenants', COUNT(*) FILTER (WHERE t.status = 'suspended'),
        'disabled_tenants', COUNT(*) FILTER (WHERE t.status = 'disabled'),
        'pending_tenants', COUNT(*) FILTER (WHERE t.status = 'pending'),
        'deleted_tenants', COUNT(*) FILTER (WHERE t.deleted_at IS NOT NULL)
      ) FROM tenants t
    ),
    'filtered_count', (
      SELECT COUNT(*)
      FROM tenants t
      WHERE (_status_filter IS NULL OR (
        CASE WHEN _status_filter = 'deleted' THEN t.deleted_at IS NOT NULL
             ELSE t.status::text = _status_filter AND t.deleted_at IS NULL
        END
      ))
      AND (_search IS NULL OR (
        t.nome ILIKE '%' || _search || '%'
        OR t.slug ILIKE '%' || _search || '%'
        OR t.id::text ILIKE '%' || _search || '%'
        OR COALESCE(t.documento, '') ILIKE '%' || _search || '%'
      ))
    ),
    'tenants', (
      SELECT COALESCE(json_agg(row_to_json(tq)), '[]'::json)
      FROM (
        SELECT
          t.id, t.nome, t.slug, t.ativo, t.status, t.plano, t.documento,
          t.dominio_customizado, t.suspended_at, t.suspended_reason,
          t.owner_user_id, t.created_at, t.deleted_at, t.deleted_by, t.deleted_reason,
          COALESCE(lc.cnt, 0) AS leads_count,
          COALESCE(pc.cnt, 0) AS users_count,
          COALESCE(cc.cnt, 0) AS clientes_count,
          s.status AS subscription_status,
          p.code AS plan_code, p.name AS plan_name,
          s.trial_ends_at, s.current_period_end,
          ow.email AS owner_email
        FROM tenants t
        LEFT JOIN LATERAL (SELECT COUNT(*)::int AS cnt FROM leads WHERE tenant_id = t.id) lc ON true
        LEFT JOIN LATERAL (SELECT COUNT(*)::int AS cnt FROM profiles WHERE tenant_id = t.id) pc ON true
        LEFT JOIN LATERAL (SELECT COUNT(*)::int AS cnt FROM clientes WHERE tenant_id = t.id) cc ON true
        LEFT JOIN subscriptions s ON s.tenant_id = t.id
        LEFT JOIN plans p ON p.id = s.plan_id
        LEFT JOIN LATERAL (
          SELECT au.email FROM auth.users au WHERE au.id = t.owner_user_id LIMIT 1
        ) ow ON true
        WHERE (_status_filter IS NULL OR (
          CASE WHEN _status_filter = 'deleted' THEN t.deleted_at IS NOT NULL
               ELSE t.status::text = _status_filter AND t.deleted_at IS NULL
          END
        ))
        AND (_search IS NULL OR (
          t.nome ILIKE '%' || _search || '%'
          OR t.slug ILIKE '%' || _search || '%'
          OR t.id::text ILIKE '%' || _search || '%'
          OR COALESCE(t.documento, '') ILIKE '%' || _search || '%'
        ))
        ORDER BY t.created_at DESC
        OFFSET _offset LIMIT _limit
      ) tq
    )
  ) INTO _result;

  RETURN _result;
END;
$fn$;

-- 3) Tenant detail RPC
CREATE OR REPLACE FUNCTION public.get_super_admin_tenant_detail(_tenant_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
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
        SELECT service_key, status, last_checked_at, error_message, metadata
        FROM integration_health_cache
        WHERE tenant_id = _tenant_id
        ORDER BY service_key
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
        SELECT p.user_id, p.nome, p.email, p.telefone, p.ativo, p.created_at,
          (SELECT COALESCE(json_agg(ur.role), '[]'::json) FROM user_roles ur WHERE ur.user_id = p.user_id) AS roles
        FROM profiles p
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
$fn$;

-- 4) Last admin protection
CREATE OR REPLACE FUNCTION public.is_last_admin_of_tenant(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  SELECT (
    SELECT COUNT(*) FROM user_roles ur
    JOIN profiles p ON p.user_id = ur.user_id AND p.tenant_id = _tenant_id
    WHERE ur.role IN ('admin', 'gerente')
      AND ur.user_id != _user_id
      AND p.ativo = true
  ) = 0;
$fn$;

-- 5) Indexes for super_admin_actions
CREATE INDEX IF NOT EXISTS idx_super_admin_actions_tenant ON public.super_admin_actions (target_tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_super_admin_actions_time ON public.super_admin_actions (created_at DESC);
