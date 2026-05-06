
-- =====================================================================
-- PR-3 — Entitlements + Limits + Usage Engine
-- =====================================================================

-- 1. Estende tenant_feature_overrides
ALTER TABLE public.tenant_feature_overrides
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS created_by uuid NULL;

DO $$ BEGIN
  ALTER TABLE public.tenant_feature_overrides
    ADD CONSTRAINT tenant_feature_overrides_source_chk
    CHECK (source IN ('plan','manual','trial','addon'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. CREATE tenant_limit_overrides
CREATE TABLE IF NOT EXISTS public.tenant_limit_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  limit_key text NOT NULL,
  limit_value integer NOT NULL,
  override_reason text NULL,
  expires_at timestamptz NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, limit_key)
);

ALTER TABLE public.tenant_limit_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tlo_super_admin_all ON public.tenant_limit_overrides;
CREATE POLICY tlo_super_admin_all ON public.tenant_limit_overrides
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE INDEX IF NOT EXISTS idx_tlo_tenant ON public.tenant_limit_overrides(tenant_id);

-- 3. ALTER subscriptions — grace period + lock
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS overdue_since timestamptz NULL,
  ADD COLUMN IF NOT EXISTS overdue_grace_until timestamptz NULL,
  ADD COLUMN IF NOT EXISTS lock_level text NOT NULL DEFAULT 'none';

DO $$ BEGIN
  ALTER TABLE public.subscriptions
    ADD CONSTRAINT subscriptions_lock_level_chk
    CHECK (lock_level IN ('none','soft','hard'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Index em usage_events para timeline rápida
CREATE INDEX IF NOT EXISTS idx_usage_events_tenant_metric_time
  ON public.usage_events(tenant_id, metric_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usage_counters_tenant_period
  ON public.usage_counters(tenant_id, period_start DESC);

-- =====================================================================
-- 5. consume_tenant_limit — atômico
-- =====================================================================
CREATE OR REPLACE FUNCTION public.consume_tenant_limit(
  _tenant_id uuid,
  _metric_key text,
  _delta integer DEFAULT 1,
  _source text DEFAULT NULL,
  _user_id uuid DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plan_id uuid;
  v_plan_limit integer;
  v_override integer;
  v_override_expires timestamptz;
  v_effective_limit integer;
  v_period_start date := date_trunc('month', CURRENT_DATE)::date;
  v_period_end date := (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::date;
  v_current integer := 0;
  v_new integer;
  v_counter_id uuid;
BEGIN
  IF _tenant_id IS NULL OR _metric_key IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_args');
  END IF;

  -- Resolve plano ativo
  SELECT s.plan_id INTO v_plan_id
  FROM public.subscriptions s
  WHERE s.tenant_id = _tenant_id
    AND s.status IN ('active','trialing','past_due')
  ORDER BY s.created_at DESC
  LIMIT 1;

  -- Limite do plano
  IF v_plan_id IS NOT NULL THEN
    SELECT pl.limit_value INTO v_plan_limit
    FROM public.plan_limits pl
    WHERE pl.plan_id = v_plan_id AND pl.limit_key = _metric_key;
  END IF;

  -- Override
  SELECT tlo.limit_value, tlo.expires_at
    INTO v_override, v_override_expires
  FROM public.tenant_limit_overrides tlo
  WHERE tlo.tenant_id = _tenant_id AND tlo.limit_key = _metric_key;

  v_effective_limit := COALESCE(
    CASE WHEN v_override IS NOT NULL
              AND (v_override_expires IS NULL OR v_override_expires > now())
         THEN v_override END,
    v_plan_limit,
    -1
  );

  -- Lock atômico: upsert com SELECT FOR UPDATE
  INSERT INTO public.usage_counters
    (tenant_id, metric_key, period_start, period_end, current_value)
  VALUES (_tenant_id, _metric_key, v_period_start, v_period_end, 0)
  ON CONFLICT (tenant_id, metric_key, period_start) DO NOTHING;

  SELECT id, current_value INTO v_counter_id, v_current
  FROM public.usage_counters
  WHERE tenant_id = _tenant_id
    AND metric_key = _metric_key
    AND period_start = v_period_start
  FOR UPDATE;

  v_new := v_current + _delta;

  IF v_effective_limit >= 0 AND v_new > v_effective_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'limit_exceeded',
      'current_value', v_current,
      'limit_value', v_effective_limit,
      'remaining', GREATEST(v_effective_limit - v_current, 0),
      'metric_key', _metric_key
    );
  END IF;

  UPDATE public.usage_counters
     SET current_value = v_new, updated_at = now()
   WHERE id = v_counter_id;

  INSERT INTO public.usage_events
    (tenant_id, metric_key, delta, source, user_id, metadata)
  VALUES (_tenant_id, _metric_key, _delta, _source, _user_id, COALESCE(_metadata,'{}'::jsonb));

  RETURN jsonb_build_object(
    'allowed', true,
    'current_value', v_new,
    'limit_value', v_effective_limit,
    'remaining', CASE WHEN v_effective_limit < 0 THEN -1 ELSE GREATEST(v_effective_limit - v_new, 0) END,
    'metric_key', _metric_key
  );
END;
$$;

-- Adiciona unique para o ON CONFLICT acima
DO $$ BEGIN
  ALTER TABLE public.usage_counters
    ADD CONSTRAINT usage_counters_tenant_metric_period_uq
    UNIQUE (tenant_id, metric_key, period_start);
EXCEPTION WHEN duplicate_object THEN NULL;
WHEN duplicate_table THEN NULL; END $$;

-- =====================================================================
-- 6. validate_plan_transition — bloqueia downgrade inválido
-- =====================================================================
CREATE OR REPLACE FUNCTION public.validate_plan_transition(
  _tenant_id uuid,
  _to_plan_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_blockers jsonb := '[]'::jsonb;
  rec RECORD;
  v_period_start date := date_trunc('month', CURRENT_DATE)::date;
  v_current integer;
BEGIN
  IF _tenant_id IS NULL OR _to_plan_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_args', 'blockers', v_blockers);
  END IF;

  FOR rec IN
    SELECT pl.limit_key, pl.limit_value
    FROM public.plan_limits pl
    WHERE pl.plan_id = _to_plan_id AND pl.limit_value >= 0
  LOOP
    SELECT COALESCE(uc.current_value, 0) INTO v_current
    FROM public.usage_counters uc
    WHERE uc.tenant_id = _tenant_id
      AND uc.metric_key = rec.limit_key
      AND uc.period_start = v_period_start;

    IF v_current > rec.limit_value THEN
      v_blockers := v_blockers || jsonb_build_object(
        'metric_key', rec.limit_key,
        'current_value', v_current,
        'new_limit', rec.limit_value
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'allowed', jsonb_array_length(v_blockers) = 0,
    'blockers', v_blockers
  );
END;
$$;

-- =====================================================================
-- 7. tenant_lock_state — calcula soft/hard
-- =====================================================================
CREATE OR REPLACE FUNCTION public.tenant_lock_state(_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_status text;
  v_canceled timestamptz;
  v_grace timestamptz;
  v_overdue timestamptz;
  v_level text := 'none';
  v_reason text := 'ok';
BEGIN
  SELECT s.status::text, s.canceled_at, s.overdue_grace_until, s.overdue_since
    INTO v_status, v_canceled, v_grace, v_overdue
  FROM public.subscriptions s
  WHERE s.tenant_id = _tenant_id
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_status IS NULL THEN
    v_level := 'hard'; v_reason := 'no_subscription';
  ELSIF v_canceled IS NOT NULL OR v_status = 'canceled' THEN
    v_level := 'hard'; v_reason := 'canceled';
  ELSIF v_status = 'past_due' THEN
    IF v_grace IS NOT NULL AND v_grace > now() THEN
      v_level := 'soft'; v_reason := 'overdue_grace';
    ELSE
      v_level := 'hard'; v_reason := 'overdue_grace_expired';
    END IF;
  ELSIF v_status IN ('active','trialing') THEN
    v_level := 'none'; v_reason := v_status;
  ELSE
    v_level := 'soft'; v_reason := COALESCE(v_status, 'unknown');
  END IF;

  RETURN jsonb_build_object(
    'level', v_level,
    'reason', v_reason,
    'subscription_status', v_status,
    'grace_until', v_grace,
    'overdue_since', v_overdue
  );
END;
$$;

-- Trigger: sincroniza lock_level em subscriptions UPDATE
CREATE OR REPLACE FUNCTION public.sync_subscription_lock_level()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_state jsonb;
BEGIN
  v_state := public.tenant_lock_state(NEW.tenant_id);
  NEW.lock_level := v_state->>'level';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_subscription_lock ON public.subscriptions;
CREATE TRIGGER trg_sync_subscription_lock
BEFORE INSERT OR UPDATE OF status, canceled_at, overdue_grace_until, overdue_since
ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.sync_subscription_lock_level();

-- =====================================================================
-- 8. tenant_health_score
-- =====================================================================
CREATE OR REPLACE FUNCTION public.tenant_health_score(_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_billing_score int := 100;
  v_webhook_score int := 100;
  v_jobs_score int := 100;
  v_wa_score int := 100;
  v_lock jsonb;
  v_webhook_failures int := 0;
  v_orphan_jobs int := 0;
  v_wa_offline int := 0;
  v_total int;
BEGIN
  -- Billing
  v_lock := public.tenant_lock_state(_tenant_id);
  v_billing_score := CASE v_lock->>'level'
    WHEN 'none' THEN 100
    WHEN 'soft' THEN 60
    WHEN 'hard' THEN 0
    ELSE 50
  END;

  -- Webhooks (últimas 24h)
  BEGIN
    SELECT COUNT(*) INTO v_webhook_failures
    FROM public.billing_webhook_events
    WHERE tenant_id = _tenant_id
      AND status IN ('failed','error')
      AND created_at > now() - interval '24 hours';
    v_webhook_score := GREATEST(0, 100 - v_webhook_failures * 10);
  EXCEPTION WHEN undefined_table THEN v_webhook_score := 100; END;

  -- Jobs órfãos (SolarMarket)
  BEGIN
    SELECT COUNT(*) INTO v_orphan_jobs
    FROM public.solarmarket_promotion_jobs
    WHERE tenant_id = _tenant_id
      AND status = 'running'
      AND last_step_at < now() - interval '10 minutes';
    v_jobs_score := GREATEST(0, 100 - v_orphan_jobs * 25);
  EXCEPTION WHEN undefined_table THEN v_jobs_score := 100; END;

  -- WhatsApp instâncias offline
  BEGIN
    SELECT COUNT(*) INTO v_wa_offline
    FROM public.whatsapp_instances
    WHERE tenant_id = _tenant_id
      AND COALESCE(status,'') NOT IN ('connected','open');
    v_wa_score := GREATEST(0, 100 - v_wa_offline * 30);
  EXCEPTION WHEN undefined_table THEN v_wa_score := 100; END;

  v_total := ((v_billing_score + v_webhook_score + v_jobs_score + v_wa_score) / 4)::int;

  RETURN jsonb_build_object(
    'score', v_total,
    'breakdown', jsonb_build_object(
      'billing', jsonb_build_object('score', v_billing_score, 'lock', v_lock),
      'webhooks', jsonb_build_object('score', v_webhook_score, 'failures_24h', v_webhook_failures),
      'jobs', jsonb_build_object('score', v_jobs_score, 'orphans', v_orphan_jobs),
      'whatsapp', jsonb_build_object('score', v_wa_score, 'offline', v_wa_offline)
    ),
    'computed_at', now()
  );
END;
$$;

-- =====================================================================
-- 9. Super Admin RPCs — overrides + reset
-- =====================================================================
CREATE OR REPLACE FUNCTION public.super_admin_set_feature_override(
  _tenant_id uuid,
  _feature_key text,
  _enabled boolean,
  _source text DEFAULT 'manual',
  _expires_at timestamptz DEFAULT NULL,
  _reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_feature_id uuid;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden: super_admin required';
  END IF;

  SELECT id INTO v_feature_id
  FROM public.feature_flags_catalog
  WHERE feature_key = _feature_key;

  IF v_feature_id IS NULL THEN
    RAISE EXCEPTION 'feature not found: %', _feature_key;
  END IF;

  INSERT INTO public.tenant_feature_overrides
    (tenant_id, feature_id, enabled, source, expires_at, reason, created_by)
  VALUES
    (_tenant_id, v_feature_id, _enabled, COALESCE(_source,'manual'), _expires_at, _reason, auth.uid())
  ON CONFLICT (tenant_id, feature_id) DO UPDATE
    SET enabled = EXCLUDED.enabled,
        source = EXCLUDED.source,
        expires_at = EXCLUDED.expires_at,
        reason = EXCLUDED.reason,
        updated_at = now();

  RETURN jsonb_build_object('ok', true, 'feature_key', _feature_key, 'enabled', _enabled);
END;
$$;

-- Garante unique para o ON CONFLICT
DO $$ BEGIN
  ALTER TABLE public.tenant_feature_overrides
    ADD CONSTRAINT tenant_feature_overrides_tenant_feature_uq
    UNIQUE (tenant_id, feature_id);
EXCEPTION WHEN duplicate_object THEN NULL;
WHEN duplicate_table THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.super_admin_set_limit_override(
  _tenant_id uuid,
  _limit_key text,
  _limit_value integer,
  _expires_at timestamptz DEFAULT NULL,
  _reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden: super_admin required';
  END IF;

  INSERT INTO public.tenant_limit_overrides
    (tenant_id, limit_key, limit_value, expires_at, override_reason, created_by)
  VALUES (_tenant_id, _limit_key, _limit_value, _expires_at, _reason, auth.uid())
  ON CONFLICT (tenant_id, limit_key) DO UPDATE
    SET limit_value = EXCLUDED.limit_value,
        expires_at = EXCLUDED.expires_at,
        override_reason = EXCLUDED.override_reason,
        updated_at = now();

  RETURN jsonb_build_object('ok', true, 'limit_key', _limit_key, 'limit_value', _limit_value);
END;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_reset_usage(
  _tenant_id uuid,
  _metric_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_period_start date := date_trunc('month', CURRENT_DATE)::date;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden: super_admin required';
  END IF;

  UPDATE public.usage_counters
     SET current_value = 0, updated_at = now()
   WHERE tenant_id = _tenant_id
     AND metric_key = _metric_key
     AND period_start = v_period_start;

  INSERT INTO public.usage_events
    (tenant_id, metric_key, delta, source, user_id, metadata)
  VALUES (_tenant_id, _metric_key, 0, 'super_admin_reset', auth.uid(),
          jsonb_build_object('reset_at', now()));

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- =====================================================================
-- 10. Super Admin GET RPCs
-- =====================================================================
CREATE OR REPLACE FUNCTION public.super_admin_get_tenant_entitlements(_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_features jsonb;
  v_limits jsonb;
  v_period_start date := date_trunc('month', CURRENT_DATE)::date;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden: super_admin required';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'feature_key', ffc.feature_key,
    'name', ffc.name,
    'category', ffc.category,
    'plan_enabled', pf.enabled,
    'override_enabled', tfo.enabled,
    'override_source', tfo.source,
    'override_expires_at', tfo.expires_at,
    'override_reason', tfo.reason,
    'effective', COALESCE(tfo.enabled, pf.enabled, false)
  ) ORDER BY ffc.category, ffc.feature_key), '[]'::jsonb)
  INTO v_features
  FROM public.feature_flags_catalog ffc
  LEFT JOIN public.subscriptions s ON s.tenant_id = _tenant_id
    AND s.status IN ('active','trialing','past_due')
  LEFT JOIN public.plan_features pf ON pf.plan_id = s.plan_id AND pf.feature_key = ffc.feature_key
  LEFT JOIN public.tenant_feature_overrides tfo ON tfo.tenant_id = _tenant_id AND tfo.feature_id = ffc.id
  WHERE ffc.is_active = true;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_limits
  FROM (
    SELECT
      pl.limit_key,
      pl.limit_value AS plan_limit,
      tlo.limit_value AS override_limit,
      tlo.expires_at AS override_expires_at,
      tlo.override_reason,
      COALESCE(
        CASE WHEN tlo.limit_value IS NOT NULL
                  AND (tlo.expires_at IS NULL OR tlo.expires_at > now())
             THEN tlo.limit_value END,
        pl.limit_value
      ) AS effective_limit,
      COALESCE(uc.current_value, 0) AS current_value
    FROM public.plan_limits pl
    JOIN public.subscriptions s ON s.plan_id = pl.plan_id AND s.tenant_id = _tenant_id
      AND s.status IN ('active','trialing','past_due')
    LEFT JOIN public.tenant_limit_overrides tlo ON tlo.tenant_id = _tenant_id AND tlo.limit_key = pl.limit_key
    LEFT JOIN public.usage_counters uc ON uc.tenant_id = _tenant_id AND uc.metric_key = pl.limit_key
      AND uc.period_start = v_period_start
    ORDER BY pl.limit_key
  ) t;

  RETURN jsonb_build_object(
    'features', v_features,
    'limits', v_limits,
    'lock_state', public.tenant_lock_state(_tenant_id),
    'health', public.tenant_health_score(_tenant_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_get_tenant_usage_events(
  _tenant_id uuid,
  _limit integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden: super_admin required';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'metric_key', metric_key,
      'delta', delta,
      'source', source,
      'created_at', created_at,
      'metadata', metadata
    ) ORDER BY created_at DESC)
    FROM (
      SELECT * FROM public.usage_events
      WHERE tenant_id = _tenant_id
      ORDER BY created_at DESC
      LIMIT GREATEST(_limit, 1)
    ) ue
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_global_health()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden: super_admin required';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'tenant_id', t.id,
      'tenant_name', t.nome,
      'health', public.tenant_health_score(t.id),
      'lock', public.tenant_lock_state(t.id)
    ) ORDER BY t.nome)
    FROM public.tenants t
    WHERE COALESCE(t.status,'') <> 'inactive'
  ), '[]'::jsonb);
END;
$$;
