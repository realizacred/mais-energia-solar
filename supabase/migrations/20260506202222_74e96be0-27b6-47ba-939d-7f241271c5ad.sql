
-- Phase 4: Real enforcement at DB level
-- Tenant-aware check (callable from triggers without auth.uid())
CREATE OR REPLACE FUNCTION public.enforce_limit_for_tenant(_tenant_id uuid, _metric_key text, _delta integer DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan_id uuid;
  _limit integer;
  _current integer;
BEGIN
  IF _tenant_id IS NULL THEN RETURN; END IF;

  SELECT s.plan_id INTO _plan_id FROM public.subscriptions s WHERE s.tenant_id = _tenant_id LIMIT 1;
  IF _plan_id IS NULL THEN RETURN; END IF;

  SELECT pl.limit_value INTO _limit FROM public.plan_limits pl
   WHERE pl.plan_id = _plan_id AND pl.limit_key = _metric_key;
  IF _limit IS NULL OR _limit < 0 THEN RETURN; END IF;

  SELECT COALESCE(uc.current_value, 0) INTO _current
  FROM public.usage_counters uc
  WHERE uc.tenant_id = _tenant_id
    AND uc.metric_key = _metric_key
    AND uc.period_start = date_trunc('month', CURRENT_DATE)::date;

  IF _current IS NULL THEN _current := 0; END IF;

  IF (_current + _delta) > _limit THEN
    RAISE EXCEPTION 'PLAN_LIMIT_EXCEEDED:% (current=%, limit=%)', _metric_key, _current, _limit
      USING ERRCODE = 'P0450';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_usage_for_tenant(_tenant_id uuid, _metric_key text, _delta integer DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _tenant_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.usage_counters (tenant_id, metric_key, period_start, current_value)
  VALUES (_tenant_id, _metric_key, date_trunc('month', CURRENT_DATE)::date, _delta)
  ON CONFLICT (tenant_id, metric_key, period_start)
  DO UPDATE SET current_value = public.usage_counters.current_value + EXCLUDED.current_value,
                updated_at = now();
END;
$$;

-- Lead enforcement: block insert if monthly quota exceeded; increment after success
CREATE OR REPLACE FUNCTION public.enforce_lead_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.enforce_limit_for_tenant(NEW.tenant_id, 'max_leads_month', 1);
  PERFORM public.increment_usage_for_tenant(NEW.tenant_id, 'max_leads_month', 1);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_lead_quota ON public.leads;
CREATE TRIGGER trg_enforce_lead_quota
BEFORE INSERT ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.enforce_lead_quota();

-- WhatsApp outbox enforcement
CREATE OR REPLACE FUNCTION public.enforce_wa_message_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.enforce_limit_for_tenant(NEW.tenant_id, 'max_wa_messages_month', 1);
  PERFORM public.increment_usage_for_tenant(NEW.tenant_id, 'max_wa_messages_month', 1);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_wa_message_quota ON public.wa_outbox;
CREATE TRIGGER trg_enforce_wa_message_quota
BEFORE INSERT ON public.wa_outbox
FOR EACH ROW
EXECUTE FUNCTION public.enforce_wa_message_quota();
