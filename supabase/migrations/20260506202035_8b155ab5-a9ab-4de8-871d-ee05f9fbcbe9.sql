
-- Phase 1: Consolidate Billing SSOT into subscriptions
-- 1) Backfill: ensure every active tenant has a subscription mirroring tenants.plano
INSERT INTO public.subscriptions (tenant_id, plan_id, status, current_period_start, current_period_end)
SELECT t.id,
       COALESCE(
         (SELECT id FROM public.plans WHERE lower(code) = lower(t.plano) LIMIT 1),
         (SELECT id FROM public.plans WHERE is_default = true LIMIT 1),
         (SELECT id FROM public.plans WHERE code = 'free' LIMIT 1)
       ),
       'active'::subscription_status,
       now(),
       now() + interval '30 days'
FROM public.tenants t
WHERE t.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.tenant_id = t.id);

-- 2) Reconcile existing subscriptions whose plan diverges from tenants.plano (legacy edits via Super Admin)
UPDATE public.subscriptions s
SET plan_id = p.id, updated_at = now()
FROM public.tenants t, public.plans p
WHERE s.tenant_id = t.id
  AND lower(p.code) = lower(t.plano)
  AND s.plan_id <> p.id
  AND t.deleted_at IS NULL;

-- 3) Trigger: when subscription status flips to suspended/canceled/expired, suspend tenant.
--    When it returns to active/trialing, re-activate.
CREATE OR REPLACE FUNCTION public.sync_tenant_status_from_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN ('suspended','canceled','expired') THEN
    UPDATE public.tenants
       SET status = 'suspended',
           suspended_at = COALESCE(suspended_at, now()),
           suspended_reason = COALESCE(suspended_reason, 'Subscription ' || NEW.status::text),
           updated_at = now()
     WHERE id = NEW.tenant_id
       AND status <> 'suspended';
  ELSIF NEW.status IN ('active','trialing','past_due') THEN
    UPDATE public.tenants
       SET status = 'active',
           suspended_at = NULL,
           suspended_reason = NULL,
           updated_at = now()
     WHERE id = NEW.tenant_id
       AND status = 'suspended'
       AND (suspended_reason LIKE 'Subscription %' OR suspended_reason IS NULL);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_tenant_status_from_subscription ON public.subscriptions;
CREATE TRIGGER trg_sync_tenant_status_from_subscription
AFTER INSERT OR UPDATE OF status ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.sync_tenant_status_from_subscription();

-- 4) Reverse trigger: legacy Super Admin edits tenants.plano -> propagate to subscriptions.plan_id
CREATE OR REPLACE FUNCTION public.sync_subscription_from_tenant_plano()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id uuid;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NEW.plano IS NULL OR NEW.plano IS NOT DISTINCT FROM OLD.plano THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_plan_id FROM public.plans WHERE lower(code) = lower(NEW.plano) LIMIT 1;
  IF v_plan_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.subscriptions
     SET plan_id = v_plan_id, updated_at = now()
   WHERE tenant_id = NEW.id
     AND plan_id <> v_plan_id;

  -- create one if missing
  INSERT INTO public.subscriptions (tenant_id, plan_id, status, current_period_start, current_period_end)
  SELECT NEW.id, v_plan_id, 'active'::subscription_status, now(), now() + interval '30 days'
  WHERE NOT EXISTS (SELECT 1 FROM public.subscriptions WHERE tenant_id = NEW.id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_subscription_from_tenant_plano ON public.tenants;
CREATE TRIGGER trg_sync_subscription_from_tenant_plano
AFTER UPDATE OF plano ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.sync_subscription_from_tenant_plano();

-- 5) Mark tenants.plano as legacy (kept for backward-compat; subscriptions is SSOT)
COMMENT ON COLUMN public.tenants.plano IS 'LEGACY: kept for backward-compat. SSOT is public.subscriptions (plan_id + status). Edits propagate via trigger trg_sync_subscription_from_tenant_plano.';
