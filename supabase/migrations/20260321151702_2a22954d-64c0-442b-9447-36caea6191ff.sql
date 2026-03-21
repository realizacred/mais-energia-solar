
-- Backend-friendly usage limit check (service_role, no auth.uid dependency)
CREATE OR REPLACE FUNCTION public.check_usage_limit_backend(
  _tenant_id UUID,
  _metric_key TEXT,
  _delta INTEGER DEFAULT 1
)
RETURNS TABLE(allowed BOOLEAN, current_value INTEGER, limit_value INTEGER, remaining INTEGER)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _plan_id UUID;
  _limit INTEGER;
  _current INTEGER;
BEGIN
  -- Get current plan from subscriptions
  SELECT s.plan_id INTO _plan_id
  FROM subscriptions s
  WHERE s.tenant_id = _tenant_id AND s.status IN ('active', 'trialing')
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF _plan_id IS NULL THEN
    RETURN QUERY SELECT true, 0, 999999, 999999;
    RETURN;
  END IF;

  -- Get limit for this metric
  SELECT pl.limit_value INTO _limit
  FROM plan_limits pl
  WHERE pl.plan_id = _plan_id AND pl.limit_key = _metric_key;

  IF _limit IS NULL THEN
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
