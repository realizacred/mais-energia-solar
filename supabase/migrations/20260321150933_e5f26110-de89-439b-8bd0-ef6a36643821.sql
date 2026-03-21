-- Add missing plan_limits for AI insights and PDF reports
INSERT INTO plan_limits (plan_id, limit_key, limit_value)
SELECT p.id, 'max_ai_insights_month', 
  CASE p.code
    WHEN 'free' THEN 0
    WHEN 'starter' THEN 0
    WHEN 'pro' THEN 100
    WHEN 'enterprise' THEN 999999
  END
FROM plans p
WHERE NOT EXISTS (
  SELECT 1 FROM plan_limits pl WHERE pl.plan_id = p.id AND pl.limit_key = 'max_ai_insights_month'
);

INSERT INTO plan_limits (plan_id, limit_key, limit_value)
SELECT p.id, 'max_reports_pdf_month', 
  CASE p.code
    WHEN 'free' THEN 0
    WHEN 'starter' THEN 5
    WHEN 'pro' THEN 30
    WHEN 'enterprise' THEN 999999
  END
FROM plans p
WHERE NOT EXISTS (
  SELECT 1 FROM plan_limits pl WHERE pl.plan_id = p.id AND pl.limit_key = 'max_reports_pdf_month'
);

INSERT INTO plan_limits (plan_id, limit_key, limit_value)
SELECT p.id, 'max_performance_alerts', 
  CASE p.code
    WHEN 'free' THEN 0
    WHEN 'starter' THEN 0
    WHEN 'pro' THEN 50
    WHEN 'enterprise' THEN 999999
  END
FROM plans p
WHERE NOT EXISTS (
  SELECT 1 FROM plan_limits pl WHERE pl.plan_id = p.id AND pl.limit_key = 'max_performance_alerts'
);

-- Create a reusable function for backend entitlement checks (SECURITY DEFINER for use in edge functions)
CREATE OR REPLACE FUNCTION public.check_feature_access(
  _tenant_id uuid,
  _feature_key text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_code text;
  v_sub_status text;
  v_override_enabled boolean;
  v_plan_enabled boolean;
  v_result jsonb;
BEGIN
  -- 1. Get active subscription
  SELECT p.code, s.status
  INTO v_plan_code, v_sub_status
  FROM subscriptions s
  JOIN plans p ON p.id = s.plan_id
  WHERE s.tenant_id = _tenant_id
    AND s.status IN ('active', 'trialing')
  ORDER BY s.created_at DESC
  LIMIT 1;

  -- 2. Check tenant override (highest priority after admin)
  SELECT tfo.enabled
  INTO v_override_enabled
  FROM tenant_feature_overrides tfo
  JOIN feature_flags_catalog ffc ON ffc.id = tfo.feature_id
  WHERE tfo.tenant_id = _tenant_id
    AND ffc.feature_key = _feature_key
  LIMIT 1;

  IF v_override_enabled IS NOT NULL THEN
    RETURN jsonb_build_object(
      'has_access', v_override_enabled,
      'source', 'override',
      'plan_code', COALESCE(v_plan_code, 'none'),
      'reason', CASE WHEN v_override_enabled THEN 'Habilitado por override' ELSE 'Desabilitado por override' END
    );
  END IF;

  -- 3. No subscription = no access
  IF v_plan_code IS NULL THEN
    RETURN jsonb_build_object(
      'has_access', false,
      'source', 'none',
      'plan_code', null,
      'reason', 'Sem assinatura ativa'
    );
  END IF;

  -- 4. Check plan features
  SELECT pf.enabled
  INTO v_plan_enabled
  FROM plan_features pf
  JOIN plans p ON p.id = pf.plan_id
  WHERE p.code = v_plan_code
    AND pf.feature_key = _feature_key
  LIMIT 1;

  IF v_plan_enabled IS NOT NULL THEN
    RETURN jsonb_build_object(
      'has_access', v_plan_enabled,
      'source', 'plan',
      'plan_code', v_plan_code,
      'reason', CASE WHEN v_plan_enabled 
        THEN 'Incluído no plano ' || v_plan_code 
        ELSE 'Não incluído no plano ' || v_plan_code 
      END
    );
  END IF;

  -- 5. Feature not in plan = denied
  RETURN jsonb_build_object(
    'has_access', false,
    'source', 'none',
    'plan_code', v_plan_code,
    'reason', 'Feature não configurada no plano'
  );
END;
$$;

-- Grant execute to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.check_feature_access(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_feature_access(uuid, text) TO service_role;