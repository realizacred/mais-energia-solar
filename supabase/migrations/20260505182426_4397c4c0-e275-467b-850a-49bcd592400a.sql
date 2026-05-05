
-- Fase 1 Billing: dunning_attempts + status suspended + auto-trial trigger

-- 1. Add 'suspended' to subscription_status enum
ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'suspended';

-- 2. dunning_attempts: log every retry/notification cycle for past_due subscriptions
CREATE TABLE IF NOT EXISTS public.dunning_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  charge_id uuid REFERENCES public.billing_charges(id) ON DELETE SET NULL,
  attempt_number int NOT NULL DEFAULT 1,
  channel text NOT NULL DEFAULT 'email', -- email | whatsapp | suspend
  status text NOT NULL DEFAULT 'pending', -- pending | sent | failed | suspended
  error_message text,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dunning_attempts_tenant ON public.dunning_attempts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dunning_attempts_subscription ON public.dunning_attempts(subscription_id, attempted_at DESC);

ALTER TABLE public.dunning_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant can view own dunning attempts"
ON public.dunning_attempts FOR SELECT
USING (tenant_id = ((auth.jwt() -> 'app_metadata') ->> 'tenant_id')::uuid);

CREATE POLICY "super_admin manages dunning"
ON public.dunning_attempts FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 3. Auto-trial trigger: every new tenant gets a 14-day trial on FREE plan
CREATE OR REPLACE FUNCTION public.auto_create_trial_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  free_plan_id uuid;
BEGIN
  SELECT id INTO free_plan_id FROM public.plans WHERE code = 'free' LIMIT 1;
  IF free_plan_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.subscriptions (
    tenant_id, plan_id, status, trial_ends_at,
    current_period_start, current_period_end
  )
  VALUES (
    NEW.id, free_plan_id, 'trialing'::subscription_status,
    now() + interval '14 days', now(), now() + interval '14 days'
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_trial_subscription ON public.tenants;
CREATE TRIGGER trg_auto_trial_subscription
AFTER INSERT ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_trial_subscription();
