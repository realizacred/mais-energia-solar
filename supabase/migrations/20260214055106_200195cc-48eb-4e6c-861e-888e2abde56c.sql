
-- =====================================================
-- P0 ENFORCEMENT: Tenant Status + User Active + Audit
-- =====================================================

-- 1) Add deleted_at to tenants
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- 2) SECURITY DEFINER: tenant_is_active(tenant_id)
CREATE OR REPLACE FUNCTION public.tenant_is_active(_tenant_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenants
    WHERE id = COALESCE(_tenant_id, get_user_tenant_id())
      AND status = 'active'
      AND deleted_at IS NULL
  );
$$;

-- 3) SECURITY DEFINER: user_is_active() - checks profiles.ativo
CREATE OR REPLACE FUNCTION public.user_is_active(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT ativo FROM profiles WHERE user_id = _user_id LIMIT 1),
    false
  );
$$;

-- 4) Combined check: tenant active AND user active
CREATE OR REPLACE FUNCTION public.tenant_and_user_active()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_is_active() AND user_is_active();
$$;

-- =====================================================
-- 5) UPDATE RLS POLICIES — CRITICAL TABLES
-- Add tenant_is_active() to all authenticated policies
-- =====================================================

-- ── PROFILES ──
DROP POLICY IF EXISTS "rls_profiles_select_own" ON public.profiles;
CREATE POLICY "rls_profiles_select_own" ON public.profiles
  FOR SELECT USING (
    tenant_id = get_user_tenant_id() AND user_id = auth.uid()
  );
-- Note: profiles SELECT doesn't require tenant_is_active (user needs to see their own profile to get status info)

DROP POLICY IF EXISTS "rls_profiles_select_admin" ON public.profiles;
CREATE POLICY "rls_profiles_select_admin" ON public.profiles
  FOR SELECT USING (
    tenant_id = get_user_tenant_id() AND is_admin(auth.uid()) AND tenant_is_active()
  );

DROP POLICY IF EXISTS "rls_profiles_update_own" ON public.profiles;
CREATE POLICY "rls_profiles_update_own" ON public.profiles
  FOR UPDATE USING (user_id = auth.uid() AND tenant_is_active())
  WITH CHECK (user_id = auth.uid() AND tenant_is_active());

DROP POLICY IF EXISTS "rls_profiles_insert_own" ON public.profiles;
CREATE POLICY "rls_profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());
-- Insert doesn't check tenant_is_active (new user registration)

-- ── USER_ROLES ──
DROP POLICY IF EXISTS "rls_user_roles_all_admin" ON public.user_roles;
CREATE POLICY "rls_user_roles_all_admin" ON public.user_roles
  FOR ALL USING (
    tenant_id = get_user_tenant_id() AND is_admin(auth.uid()) AND tenant_is_active()
  ) WITH CHECK (
    tenant_id = get_user_tenant_id() AND is_admin(auth.uid()) AND tenant_is_active()
  );

DROP POLICY IF EXISTS "rls_user_roles_select_own" ON public.user_roles;
CREATE POLICY "rls_user_roles_select_own" ON public.user_roles
  FOR SELECT USING (
    tenant_id = get_user_tenant_id() AND user_id = auth.uid()
  );
-- Own role SELECT doesn't require tenant_is_active (needed for guard check)

-- ── LEADS ──
DROP POLICY IF EXISTS "rls_leads_all_admin" ON public.leads;
CREATE POLICY "rls_leads_all_admin" ON public.leads
  FOR ALL USING (
    tenant_id = get_user_tenant_id() AND is_admin(auth.uid()) AND tenant_and_user_active()
  ) WITH CHECK (
    tenant_id = get_user_tenant_id() AND is_admin(auth.uid()) AND tenant_and_user_active()
  );

DROP POLICY IF EXISTS "rls_leads_select_consultor" ON public.leads;
CREATE POLICY "rls_leads_select_consultor" ON public.leads
  FOR SELECT USING (
    tenant_id = get_user_tenant_id() AND tenant_and_user_active()
    AND consultor_id IN (
      SELECT v.id FROM consultores v
      WHERE v.user_id = auth.uid() AND v.tenant_id = get_user_tenant_id() AND v.ativo = true
    )
  );

DROP POLICY IF EXISTS "rls_leads_select_wa_assigned" ON public.leads;
CREATE POLICY "rls_leads_select_wa_assigned" ON public.leads
  FOR SELECT USING (
    tenant_id = get_user_tenant_id() AND tenant_and_user_active()
    AND id IN (
      SELECT wc.lead_id FROM wa_conversations wc
      WHERE wc.lead_id = leads.id AND wc.assigned_to = auth.uid() AND wc.tenant_id = get_user_tenant_id()
    )
  );

-- Keep public insert for leads (anonymous form submission)
-- rls_leads_insert_public stays as-is (no auth required)

-- ── CLIENTES ──
DROP POLICY IF EXISTS "rls_clientes_all_admin" ON public.clientes;
CREATE POLICY "rls_clientes_all_admin" ON public.clientes
  FOR ALL USING (
    tenant_id = get_user_tenant_id() AND is_admin(auth.uid()) AND tenant_and_user_active()
  ) WITH CHECK (
    tenant_id = get_user_tenant_id() AND is_admin(auth.uid()) AND tenant_and_user_active()
  );

DROP POLICY IF EXISTS "rls_clientes_select_consultor" ON public.clientes;
CREATE POLICY "rls_clientes_select_consultor" ON public.clientes
  FOR SELECT USING (
    tenant_id = get_user_tenant_id() AND tenant_and_user_active()
    AND lead_id IN (
      SELECT l.id FROM leads l
      WHERE l.tenant_id = get_user_tenant_id() AND l.consultor_id IN (
        SELECT v.id FROM consultores v
        WHERE v.user_id = auth.uid() AND v.tenant_id = get_user_tenant_id() AND v.ativo = true
      )
    )
  );

-- ── PROJETOS ──
DROP POLICY IF EXISTS "rls_projetos_all_admin" ON public.projetos;
CREATE POLICY "rls_projetos_all_admin" ON public.projetos
  FOR ALL USING (
    tenant_id = get_user_tenant_id() AND is_admin(auth.uid()) AND tenant_and_user_active()
  ) WITH CHECK (
    tenant_id = get_user_tenant_id() AND is_admin(auth.uid()) AND tenant_and_user_active()
  );

DROP POLICY IF EXISTS "rls_projetos_select_consultor" ON public.projetos;
CREATE POLICY "rls_projetos_select_consultor" ON public.projetos
  FOR SELECT USING (
    tenant_id = get_user_tenant_id() AND tenant_and_user_active()
    AND consultor_id IN (
      SELECT v.id FROM consultores v
      WHERE v.user_id = auth.uid() AND v.tenant_id = get_user_tenant_id()
    )
  );

DROP POLICY IF EXISTS "rls_projetos_select_instalador" ON public.projetos;
CREATE POLICY "rls_projetos_select_instalador" ON public.projetos
  FOR SELECT USING (
    tenant_id = get_user_tenant_id() AND tenant_and_user_active()
    AND instalador_id = auth.uid()
  );

-- ── PROPOSTAS ──
DROP POLICY IF EXISTS "rls_propostas_all_admin" ON public.propostas;
CREATE POLICY "rls_propostas_all_admin" ON public.propostas
  FOR ALL USING (
    tenant_id = get_user_tenant_id() AND is_admin(auth.uid()) AND tenant_and_user_active()
  ) WITH CHECK (
    tenant_id = get_user_tenant_id() AND is_admin(auth.uid()) AND tenant_and_user_active()
  );

DROP POLICY IF EXISTS "rls_propostas_select_consultor" ON public.propostas;
CREATE POLICY "rls_propostas_select_consultor" ON public.propostas
  FOR SELECT USING (
    tenant_id = get_user_tenant_id() AND tenant_and_user_active()
    AND consultor_id IN (
      SELECT v.id FROM consultores v
      WHERE v.user_id = auth.uid() AND v.tenant_id = get_user_tenant_id()
    )
  );

-- ── WA_INSTANCES ──
DROP POLICY IF EXISTS "rls_wa_instances_all_admin" ON public.wa_instances;
CREATE POLICY "rls_wa_instances_all_admin" ON public.wa_instances
  FOR ALL USING (
    tenant_id = get_user_tenant_id() AND is_admin(auth.uid()) AND tenant_and_user_active()
  ) WITH CHECK (
    tenant_id = get_user_tenant_id() AND is_admin(auth.uid()) AND tenant_and_user_active()
  );

-- Keep vendor select policy but add tenant_and_user_active
DROP POLICY IF EXISTS "rls_wa_instances_select_vendor" ON public.wa_instances;
CREATE POLICY "rls_wa_instances_select_vendor" ON public.wa_instances
  FOR SELECT USING (
    tenant_id = get_user_tenant_id() AND tenant_and_user_active()
    AND (
      owner_user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM wa_instance_consultores wiv
        JOIN consultores v ON v.id = wiv.consultor_id
        WHERE wiv.instance_id = wa_instances.id
          AND v.user_id = auth.uid() AND v.ativo = true
      )
    )
  );

-- ── INTEGRATION_CONFIGS ──
DROP POLICY IF EXISTS "Admins can read integration configs" ON public.integration_configs;
CREATE POLICY "Admins can read integration configs" ON public.integration_configs
  FOR SELECT USING (is_admin(auth.uid()) AND tenant_id = get_user_tenant_id() AND tenant_and_user_active());

DROP POLICY IF EXISTS "Admins can insert integration configs" ON public.integration_configs;
CREATE POLICY "Admins can insert integration configs" ON public.integration_configs
  FOR INSERT WITH CHECK (is_admin(auth.uid()) AND tenant_id = get_user_tenant_id() AND tenant_and_user_active());

DROP POLICY IF EXISTS "Admins can update integration configs" ON public.integration_configs;
CREATE POLICY "Admins can update integration configs" ON public.integration_configs
  FOR UPDATE USING (is_admin(auth.uid()) AND tenant_id = get_user_tenant_id() AND tenant_and_user_active())
  WITH CHECK (is_admin(auth.uid()) AND tenant_id = get_user_tenant_id() AND tenant_and_user_active());

DROP POLICY IF EXISTS "Admins can delete integration configs" ON public.integration_configs;
CREATE POLICY "Admins can delete integration configs" ON public.integration_configs
  FOR DELETE USING (is_admin(auth.uid()) AND tenant_id = get_user_tenant_id() AND tenant_and_user_active());

-- ── GOOGLE_CALENDAR_TOKENS ──
DROP POLICY IF EXISTS "Admins can view tenant tokens" ON public.google_calendar_tokens;
CREATE POLICY "Admins can view tenant tokens" ON public.google_calendar_tokens
  FOR SELECT USING (is_admin(auth.uid()) AND tenant_id = get_user_tenant_id() AND tenant_and_user_active());

DROP POLICY IF EXISTS "Users can view own tokens" ON public.google_calendar_tokens;
CREATE POLICY "Users can view own tokens" ON public.google_calendar_tokens
  FOR SELECT USING (auth.uid() = user_id AND tenant_and_user_active());

DROP POLICY IF EXISTS "Users can insert own tokens" ON public.google_calendar_tokens;
CREATE POLICY "Users can insert own tokens" ON public.google_calendar_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id AND tenant_id = get_user_tenant_id() AND tenant_and_user_active());

DROP POLICY IF EXISTS "Users can update own tokens" ON public.google_calendar_tokens;
CREATE POLICY "Users can update own tokens" ON public.google_calendar_tokens
  FOR UPDATE USING (auth.uid() = user_id AND tenant_and_user_active())
  WITH CHECK (tenant_id = get_user_tenant_id() AND tenant_and_user_active());

DROP POLICY IF EXISTS "Users can delete own tokens" ON public.google_calendar_tokens;
CREATE POLICY "Users can delete own tokens" ON public.google_calendar_tokens
  FOR DELETE USING (auth.uid() = user_id AND tenant_and_user_active());

-- ── INTEGRATION_HEALTH_CACHE ──
DROP POLICY IF EXISTS "Users can view own tenant health" ON public.integration_health_cache;
CREATE POLICY "Users can view own tenant health" ON public.integration_health_cache
  FOR SELECT USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());

-- ── AUDIT_LOGS ──
DROP POLICY IF EXISTS "rls_audit_logs_select_admin" ON public.audit_logs;
CREATE POLICY "rls_audit_logs_select_admin" ON public.audit_logs
  FOR SELECT USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()) AND tenant_is_active());
-- Note: audit_logs uses tenant_is_active only (not user_is_active) so admins can still see logs

-- ── ORCAMENTOS ──
DROP POLICY IF EXISTS "rls_orcamentos_all_admin" ON public.orcamentos;
CREATE POLICY "rls_orcamentos_all_admin" ON public.orcamentos
  FOR ALL USING (
    tenant_id = get_user_tenant_id() AND is_admin(auth.uid()) AND tenant_and_user_active()
  ) WITH CHECK (
    tenant_id = get_user_tenant_id() AND is_admin(auth.uid()) AND tenant_and_user_active()
  );

DROP POLICY IF EXISTS "rls_orcamentos_select_consultor" ON public.orcamentos;
CREATE POLICY "rls_orcamentos_select_consultor" ON public.orcamentos
  FOR SELECT USING (
    tenant_id = get_user_tenant_id() AND tenant_and_user_active()
    AND consultor_id IN (
      SELECT v.id FROM consultores v
      WHERE v.user_id = auth.uid() AND v.tenant_id = get_user_tenant_id() AND v.ativo = true
    )
  );

DROP POLICY IF EXISTS "rls_orcamentos_update_consultor" ON public.orcamentos;
CREATE POLICY "rls_orcamentos_update_consultor" ON public.orcamentos
  FOR UPDATE USING (
    tenant_id = get_user_tenant_id() AND tenant_and_user_active()
    AND consultor_id IN (
      SELECT v.id FROM consultores v
      WHERE v.user_id = auth.uid() AND v.tenant_id = get_user_tenant_id() AND v.ativo = true
    )
  ) WITH CHECK (tenant_id = get_user_tenant_id() AND tenant_and_user_active());

DROP POLICY IF EXISTS "rls_orcamentos_delete_consultor" ON public.orcamentos;
CREATE POLICY "rls_orcamentos_delete_consultor" ON public.orcamentos
  FOR DELETE USING (
    tenant_id = get_user_tenant_id() AND tenant_and_user_active()
    AND consultor_id IN (
      SELECT v.id FROM consultores v
      WHERE v.user_id = auth.uid() AND v.tenant_id = get_user_tenant_id() AND v.ativo = true
    )
  );

-- =====================================================
-- 6) AUDIT TRIGGERS: tenants + user_roles (G29, G30)
-- =====================================================

-- tenants audit trigger
CREATE TRIGGER audit_tenants_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger_fn();

-- user_roles audit trigger
CREATE TRIGGER audit_user_roles_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger_fn();

-- =====================================================
-- 7) SUPER ADMIN METRICS RPC (G8) — zero N+1
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_super_admin_metrics(
  _status_filter text DEFAULT NULL,
  _search text DEFAULT NULL,
  _offset integer DEFAULT 0,
  _limit integer DEFAULT 50
)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result json;
BEGIN
  -- Verify caller is super_admin
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
        'pending_tenants', COUNT(*) FILTER (WHERE t.status = 'pending')
      ) FROM tenants t WHERE t.deleted_at IS NULL
    ),
    'tenants', (
      SELECT COALESCE(json_agg(row_to_json(tq)), '[]'::json)
      FROM (
        SELECT
          t.id, t.nome, t.slug, t.ativo, t.status, t.plano,
          t.suspended_at, t.suspended_reason, t.owner_user_id, t.created_at,
          COALESCE(lc.cnt, 0) AS leads_count,
          COALESCE(pc.cnt, 0) AS users_count,
          COALESCE(cc.cnt, 0) AS clientes_count,
          s.status AS subscription_status,
          p.code AS plan_code, p.name AS plan_name,
          s.trial_ends_at, s.current_period_end
        FROM tenants t
        LEFT JOIN LATERAL (SELECT COUNT(*)::int AS cnt FROM leads WHERE tenant_id = t.id) lc ON true
        LEFT JOIN LATERAL (SELECT COUNT(*)::int AS cnt FROM profiles WHERE tenant_id = t.id) pc ON true
        LEFT JOIN LATERAL (SELECT COUNT(*)::int AS cnt FROM clientes WHERE tenant_id = t.id) cc ON true
        LEFT JOIN subscriptions s ON s.tenant_id = t.id
        LEFT JOIN plans p ON p.id = s.plan_id
        WHERE t.deleted_at IS NULL
          AND (_status_filter IS NULL OR t.status::text = _status_filter)
          AND (_search IS NULL OR t.nome ILIKE '%' || _search || '%' OR t.slug ILIKE '%' || _search || '%')
        ORDER BY t.created_at DESC
        OFFSET _offset LIMIT _limit
      ) tq
    )
  ) INTO _result;

  RETURN _result;
END;
$$;

-- =====================================================
-- 8) TENANT STATUS RPC for frontend guard
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_my_tenant_status()
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tid uuid;
  _result json;
BEGIN
  _tid := get_user_tenant_id();
  IF _tid IS NULL THEN
    RETURN json_build_object('status', 'unknown', 'error', 'no_tenant');
  END IF;

  SELECT json_build_object(
    'status', t.status::text,
    'ativo', t.ativo,
    'suspended_at', t.suspended_at,
    'suspended_reason', t.suspended_reason,
    'deleted_at', t.deleted_at,
    'tenant_name', t.nome
  ) INTO _result
  FROM tenants t WHERE t.id = _tid;

  IF _result IS NULL THEN
    RETURN json_build_object('status', 'unknown', 'error', 'tenant_not_found');
  END IF;

  RETURN _result;
END;
$$;
