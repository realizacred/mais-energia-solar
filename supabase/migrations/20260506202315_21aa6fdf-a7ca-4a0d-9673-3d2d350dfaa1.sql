
-- Phase 2: Lifecycle automation
CREATE OR REPLACE FUNCTION public.run_subscription_lifecycle()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trials_to_past_due int := 0;
  v_periods_to_past_due int := 0;
  v_past_due_to_suspended int := 0;
  v_grace_to_expired int := 0;
BEGIN
  -- Trial expired -> past_due (7d grace)
  WITH upd AS (
    UPDATE public.subscriptions
       SET status = 'past_due', updated_at = now()
     WHERE status = 'trialing'
       AND trial_ends_at IS NOT NULL
       AND trial_ends_at < now()
     RETURNING 1
  ) SELECT count(*) INTO v_trials_to_past_due FROM upd;

  -- Active period expired (no renewal) -> past_due
  WITH upd AS (
    UPDATE public.subscriptions
       SET status = 'past_due', updated_at = now()
     WHERE status = 'active'
       AND current_period_end IS NOT NULL
       AND current_period_end < now()
     RETURNING 1
  ) SELECT count(*) INTO v_periods_to_past_due FROM upd;

  -- past_due > 7d -> suspended (trigger from Phase 1 will suspend tenant)
  WITH upd AS (
    UPDATE public.subscriptions
       SET status = 'suspended', updated_at = now()
     WHERE status = 'past_due'
       AND updated_at < now() - interval '7 days'
     RETURNING 1
  ) SELECT count(*) INTO v_past_due_to_suspended FROM upd;

  -- past_due trials > 7d after trial end -> expired
  WITH upd AS (
    UPDATE public.subscriptions
       SET status = 'expired', updated_at = now()
     WHERE status = 'past_due'
       AND trial_ends_at IS NOT NULL
       AND trial_ends_at < now() - interval '7 days'
       AND current_period_end IS NULL
     RETURNING 1
  ) SELECT count(*) INTO v_grace_to_expired FROM upd;

  RETURN jsonb_build_object(
    'trials_to_past_due', v_trials_to_past_due,
    'periods_to_past_due', v_periods_to_past_due,
    'past_due_to_suspended', v_past_due_to_suspended,
    'grace_to_expired', v_grace_to_expired,
    'ran_at', now()
  );
END;
$$;
