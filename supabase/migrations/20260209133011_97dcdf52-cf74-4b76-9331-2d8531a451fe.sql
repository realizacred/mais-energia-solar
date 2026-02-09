
-- =====================================================
-- FASE SaaS-1: Plans / Subscriptions / Limits / Usage
-- =====================================================

-- 1) PLANS
CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  price_monthly NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_yearly NUMERIC(10,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- Plans are readable by any authenticated user (public catalog)
CREATE POLICY "plans_select_authenticated" ON public.plans
  FOR SELECT TO authenticated USING (true);

-- Only super_admin can manage plans
CREATE POLICY "plans_manage_super_admin" ON public.plans
  FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));

CREATE TRIGGER update_plans_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.plans IS 'Catálogo de planos SaaS disponíveis (FREE, STARTER, PRO, ENTERPRISE)';

-- 2) PLAN_FEATURES
CREATE TABLE public.plan_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(plan_id, feature_key)
);

ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plan_features_select_authenticated" ON public.plan_features
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "plan_features_manage_super_admin" ON public.plan_features
  FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));

COMMENT ON TABLE public.plan_features IS 'Features booleanas habilitadas por plano (ex: whatsapp_automation, ai_insights)';

-- 3) PLAN_LIMITS
CREATE TABLE public.plan_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  limit_key TEXT NOT NULL,
  limit_value INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(plan_id, limit_key)
);

ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plan_limits_select_authenticated" ON public.plan_limits
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "plan_limits_manage_super_admin" ON public.plan_limits
  FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));

COMMENT ON TABLE public.plan_limits IS 'Limites numéricos por plano (ex: max_users=5, max_leads_month=100)';

-- 4) SUBSCRIPTIONS (tenant-aware)
CREATE TYPE public.subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'expired');

CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.plans(id),
  status public.subscription_status NOT NULL DEFAULT 'trialing',
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  canceled_at TIMESTAMPTZ,
  external_id TEXT, -- para futuro Stripe subscription ID
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id) -- um tenant tem no máximo uma subscription ativa
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Admin/owner do tenant pode ler sua subscription
CREATE POLICY "subscriptions_select_own_tenant" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

-- Super admin pode gerenciar todas
CREATE POLICY "subscriptions_manage_super_admin" ON public.subscriptions
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.subscriptions IS 'Assinatura ativa de cada tenant com status, período e trial';

-- 5) USAGE_COUNTERS (tenant-aware, period-based)
CREATE TABLE public.usage_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  metric_key TEXT NOT NULL,
  period_start DATE NOT NULL DEFAULT date_trunc('month', CURRENT_DATE)::date,
  period_end DATE NOT NULL DEFAULT (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::date,
  current_value INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, metric_key, period_start)
);

ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usage_counters_select_own_tenant" ON public.usage_counters
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "usage_counters_manage_super_admin" ON public.usage_counters
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE TRIGGER update_usage_counters_updated_at
  BEFORE UPDATE ON public.usage_counters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.usage_counters IS 'Contadores de uso mensal por tenant (leads criados, msgs enviadas, etc)';

-- 6) USAGE_EVENTS (audit trail)
CREATE TABLE public.usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  metric_key TEXT NOT NULL,
  delta INTEGER NOT NULL DEFAULT 1,
  source TEXT, -- 'lead_insert', 'wa_send', 'user_create', etc.
  user_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usage_events_select_admin" ON public.usage_events
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND public.is_admin(auth.uid())
  );

CREATE POLICY "usage_events_manage_super_admin" ON public.usage_events
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- Index for efficient querying
CREATE INDEX idx_usage_events_tenant_metric ON public.usage_events(tenant_id, metric_key, created_at DESC);
CREATE INDEX idx_usage_counters_tenant_period ON public.usage_counters(tenant_id, period_start);

COMMENT ON TABLE public.usage_events IS 'Log de auditoria de eventos de uso para rastreabilidade';

-- =====================================================
-- RPC FUNCTIONS (security definer)
-- =====================================================

-- get_tenant_subscription(): retorna subscription + plan do tenant do usuário
CREATE OR REPLACE FUNCTION public.get_tenant_subscription()
RETURNS TABLE (
  subscription_id UUID,
  plan_code TEXT,
  plan_name TEXT,
  status public.subscription_status,
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN,
  price_monthly NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id AS subscription_id,
    p.code AS plan_code,
    p.name AS plan_name,
    s.status,
    s.trial_ends_at,
    s.current_period_start,
    s.current_period_end,
    s.cancel_at_period_end,
    p.price_monthly
  FROM subscriptions s
  JOIN plans p ON p.id = s.plan_id
  WHERE s.tenant_id = get_user_tenant_id()
  LIMIT 1;
$$;

-- check_tenant_limit(metric_key, delta): retorna se o tenant pode consumir mais
CREATE OR REPLACE FUNCTION public.check_tenant_limit(
  _metric_key TEXT,
  _delta INTEGER DEFAULT 1
)
RETURNS TABLE (
  allowed BOOLEAN,
  current_value INTEGER,
  limit_value INTEGER,
  remaining INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant_id UUID;
  _plan_id UUID;
  _limit INTEGER;
  _current INTEGER;
BEGIN
  _tenant_id := get_user_tenant_id();
  
  -- Get current plan
  SELECT s.plan_id INTO _plan_id
  FROM subscriptions s
  WHERE s.tenant_id = _tenant_id
  LIMIT 1;
  
  IF _plan_id IS NULL THEN
    -- No subscription = no limits (shouldn't happen, but safe default)
    RETURN QUERY SELECT true, 0, 999999, 999999;
    RETURN;
  END IF;
  
  -- Get limit for this metric
  SELECT pl.limit_value INTO _limit
  FROM plan_limits pl
  WHERE pl.plan_id = _plan_id AND pl.limit_key = _metric_key;
  
  IF _limit IS NULL THEN
    -- No limit defined = unlimited
    RETURN QUERY SELECT true, 0, -1, -1;
    RETURN;
  END IF;
  
  -- Get current usage for this period
  SELECT COALESCE(uc.current_value, 0) INTO _current
  FROM usage_counters uc
  WHERE uc.tenant_id = _tenant_id
    AND uc.metric_key = _metric_key
    AND uc.period_start = date_trunc('month', CURRENT_DATE)::date;
  
  IF _current IS NULL THEN _current := 0; END IF;
  
  RETURN QUERY SELECT
    (_current + _delta) <= _limit,
    _current,
    _limit,
    GREATEST(_limit - _current, 0);
END;
$$;

-- increment_usage(metric_key, delta, source): incrementa contador + registra evento
CREATE OR REPLACE FUNCTION public.increment_usage(
  _metric_key TEXT,
  _delta INTEGER DEFAULT 1,
  _source TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant_id UUID;
  _period_start DATE;
  _period_end DATE;
BEGIN
  _tenant_id := get_user_tenant_id();
  _period_start := date_trunc('month', CURRENT_DATE)::date;
  _period_end := (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::date;
  
  -- Upsert counter
  INSERT INTO usage_counters (tenant_id, metric_key, period_start, period_end, current_value)
  VALUES (_tenant_id, _metric_key, _period_start, _period_end, _delta)
  ON CONFLICT (tenant_id, metric_key, period_start)
  DO UPDATE SET current_value = usage_counters.current_value + _delta, updated_at = now();
  
  -- Log event
  INSERT INTO usage_events (tenant_id, metric_key, delta, source, user_id)
  VALUES (_tenant_id, _metric_key, _delta, _source, auth.uid());
END;
$$;

-- enforce_limit_or_throw(metric_key, delta): verifica e lança erro padronizado
CREATE OR REPLACE FUNCTION public.enforce_limit_or_throw(
  _metric_key TEXT,
  _delta INTEGER DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _allowed BOOLEAN;
  _current INTEGER;
  _limit INTEGER;
BEGIN
  SELECT cl.allowed, cl.current_value, cl.limit_value
  INTO _allowed, _current, _limit
  FROM check_tenant_limit(_metric_key, _delta) cl;
  
  IF _allowed = false THEN
    RAISE EXCEPTION 'PLAN_LIMIT_EXCEEDED:% (current=%, limit=%)', _metric_key, _current, _limit
      USING ERRCODE = 'P0450';
  END IF;
END;
$$;

-- =====================================================
-- SEED DATA: Plans + Features + Limits
-- =====================================================

-- Plans
INSERT INTO public.plans (code, name, description, price_monthly, price_yearly, is_default, sort_order) VALUES
  ('free',       'Free',       'Para conhecer a plataforma', 0, 0, true, 0),
  ('starter',    'Starter',    'Para empresas pequenas',     197, 1970, false, 1),
  ('pro',        'Pro',        'Para empresas em crescimento', 497, 4970, false, 2),
  ('enterprise', 'Enterprise', 'Para grandes operações',     997, 9970, false, 3);

-- Features (feature_key -> enabled per plan)
-- Keys: whatsapp_automation, ai_insights, advanced_reports, gamification, solar_market, multi_instance_wa, api_access, white_label
INSERT INTO public.plan_features (plan_id, feature_key, enabled)
SELECT p.id, f.feature_key, f.enabled
FROM public.plans p
CROSS JOIN (VALUES
  ('free',       'whatsapp_automation', false),
  ('free',       'ai_insights',        false),
  ('free',       'advanced_reports',   false),
  ('free',       'gamification',       false),
  ('free',       'solar_market',       false),
  ('free',       'multi_instance_wa',  false),
  ('free',       'api_access',         false),
  ('free',       'white_label',        false),
  ('starter',    'whatsapp_automation', true),
  ('starter',    'ai_insights',        false),
  ('starter',    'advanced_reports',   false),
  ('starter',    'gamification',       true),
  ('starter',    'solar_market',       true),
  ('starter',    'multi_instance_wa',  false),
  ('starter',    'api_access',         false),
  ('starter',    'white_label',        false),
  ('pro',        'whatsapp_automation', true),
  ('pro',        'ai_insights',        true),
  ('pro',        'advanced_reports',   true),
  ('pro',        'gamification',       true),
  ('pro',        'solar_market',       true),
  ('pro',        'multi_instance_wa',  true),
  ('pro',        'api_access',         true),
  ('pro',        'white_label',        false),
  ('enterprise', 'whatsapp_automation', true),
  ('enterprise', 'ai_insights',        true),
  ('enterprise', 'advanced_reports',   true),
  ('enterprise', 'gamification',       true),
  ('enterprise', 'solar_market',       true),
  ('enterprise', 'multi_instance_wa',  true),
  ('enterprise', 'api_access',         true),
  ('enterprise', 'white_label',        true)
) AS f(plan_code, feature_key, enabled)
WHERE p.code = f.plan_code;

-- Limits (limit_key -> value per plan)
-- Keys: max_users, max_leads_month, max_wa_messages_month, max_automations, max_storage_mb, max_proposals_month
INSERT INTO public.plan_limits (plan_id, limit_key, limit_value)
SELECT p.id, l.limit_key, l.limit_value
FROM public.plans p
CROSS JOIN (VALUES
  ('free',       'max_users',              2),
  ('free',       'max_leads_month',        50),
  ('free',       'max_wa_messages_month',  0),
  ('free',       'max_automations',        0),
  ('free',       'max_storage_mb',         100),
  ('free',       'max_proposals_month',    10),
  ('starter',    'max_users',              5),
  ('starter',    'max_leads_month',        300),
  ('starter',    'max_wa_messages_month',  500),
  ('starter',    'max_automations',        5),
  ('starter',    'max_storage_mb',         1000),
  ('starter',    'max_proposals_month',    50),
  ('pro',        'max_users',              15),
  ('pro',        'max_leads_month',        1000),
  ('pro',        'max_wa_messages_month',  3000),
  ('pro',        'max_automations',        20),
  ('pro',        'max_storage_mb',         5000),
  ('pro',        'max_proposals_month',    200),
  ('enterprise', 'max_users',              50),
  ('enterprise', 'max_leads_month',        10000),
  ('enterprise', 'max_wa_messages_month',  20000),
  ('enterprise', 'max_automations',        100),
  ('enterprise', 'max_storage_mb',         50000),
  ('enterprise', 'max_proposals_month',    5000)
) AS l(plan_code, limit_key, limit_value)
WHERE p.code = l.plan_code;

-- Assign FREE plan to existing tenant(s) with 14-day trial
INSERT INTO public.subscriptions (tenant_id, plan_id, status, trial_ends_at, current_period_start, current_period_end)
SELECT t.id, p.id, 'trialing', now() + interval '14 days', now(), now() + interval '30 days'
FROM public.tenants t
CROSS JOIN public.plans p
WHERE p.code = 'free' AND t.ativo = true
ON CONFLICT (tenant_id) DO NOTHING;
