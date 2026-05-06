
-- ============================================================================
-- Super Admin Billing — Canonical RPCs (PR-2)
-- ============================================================================

-- 1. Canonical mutation RPC
CREATE OR REPLACE FUNCTION public.super_admin_change_subscription(
  _tenant_id uuid,
  _plan_code text DEFAULT NULL,
  _status public.subscription_status DEFAULT NULL,
  _trial_ends_at timestamptz DEFAULT NULL,
  _current_period_end timestamptz DEFAULT NULL,
  _cancel_at_period_end boolean DEFAULT NULL,
  _reason text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _admin_id uuid := auth.uid();
  _sub public.subscriptions%ROWTYPE;
  _new_plan_id uuid;
  _before jsonb;
  _after jsonb;
BEGIN
  IF NOT is_super_admin(_admin_id) THEN
    RAISE EXCEPTION 'Forbidden: super_admin required' USING ERRCODE = 'P0403';
  END IF;

  SELECT * INTO _sub FROM public.subscriptions WHERE tenant_id = _tenant_id LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found for tenant %', _tenant_id USING ERRCODE = 'P0404';
  END IF;

  _before := to_jsonb(_sub);

  IF _plan_code IS NOT NULL THEN
    SELECT id INTO _new_plan_id FROM public.plans WHERE code = _plan_code AND is_active = true;
    IF _new_plan_id IS NULL THEN
      RAISE EXCEPTION 'Plan code % not found or inactive', _plan_code USING ERRCODE = 'P0422';
    END IF;
  END IF;

  UPDATE public.subscriptions
     SET plan_id = COALESCE(_new_plan_id, plan_id),
         status = COALESCE(_status, status),
         trial_ends_at = CASE
           WHEN _trial_ends_at IS NOT NULL THEN _trial_ends_at
           WHEN _status IS NOT NULL AND _status <> 'trialing' THEN NULL
           ELSE trial_ends_at
         END,
         current_period_end = COALESCE(_current_period_end, current_period_end),
         cancel_at_period_end = COALESCE(_cancel_at_period_end, cancel_at_period_end),
         canceled_at = CASE
           WHEN _status = 'canceled' THEN COALESCE(canceled_at, now())
           WHEN _status IS NOT NULL AND _status <> 'canceled' THEN NULL
           ELSE canceled_at
         END,
         updated_at = now()
   WHERE id = _sub.id
   RETURNING to_jsonb(subscriptions.*) INTO _after;

  -- Sync tenants.plano (legacy mirror only — UI is read-only)
  IF _plan_code IS NOT NULL THEN
    UPDATE public.tenants SET plano = _plan_code, updated_at = now() WHERE id = _tenant_id;
  END IF;

  INSERT INTO public.super_admin_actions (admin_user_id, action, target_tenant_id, details)
  VALUES (
    _admin_id,
    'change_subscription',
    _tenant_id,
    jsonb_build_object(
      'before', _before,
      'after', _after,
      'reason', _reason,
      'inputs', jsonb_build_object(
        'plan_code', _plan_code,
        'status', _status,
        'trial_ends_at', _trial_ends_at,
        'current_period_end', _current_period_end,
        'cancel_at_period_end', _cancel_at_period_end
      )
    )
  );

  RETURN json_build_object('success', true, 'subscription', _after);
END;
$$;

GRANT EXECUTE ON FUNCTION public.super_admin_change_subscription(uuid, text, public.subscription_status, timestamptz, timestamptz, boolean, text) TO authenticated;

-- 2. Tenant billing detail RPC
CREATE OR REPLACE FUNCTION public.super_admin_get_tenant_billing(_tenant_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden: super_admin required' USING ERRCODE = 'P0403';
  END IF;

  RETURN json_build_object(
    'subscription', (
      SELECT row_to_json(sq) FROM (
        SELECT s.id, s.tenant_id, s.status::text, s.trial_ends_at,
               s.current_period_start, s.current_period_end,
               s.cancel_at_period_end, s.canceled_at, s.external_id,
               s.created_at, s.updated_at,
               p.id AS plan_id, p.code AS plan_code, p.name AS plan_name,
               p.price_monthly
        FROM subscriptions s
        JOIN plans p ON p.id = s.plan_id
        WHERE s.tenant_id = _tenant_id LIMIT 1
      ) sq
    ),
    'charges', (
      SELECT COALESCE(json_agg(row_to_json(c) ORDER BY c.created_at DESC), '[]'::json)
      FROM (
        SELECT id, asaas_charge_id, plan_id, valor, status, due_date,
               invoice_url, payment_link, paid_at, created_at
        FROM billing_charges
        WHERE tenant_id = _tenant_id
        ORDER BY created_at DESC
        LIMIT 50
      ) c
    ),
    'webhook_events', (
      SELECT COALESCE(json_agg(row_to_json(w) ORDER BY w.received_at DESC), '[]'::json)
      FROM (
        SELECT id, provider, provider_event_id, received_at, processed_at, status, error_message,
               (payload -> 'event') AS event_type
        FROM billing_webhook_events
        WHERE tenant_id = _tenant_id
        ORDER BY received_at DESC
        LIMIT 30
      ) w
    ),
    'dunning', (
      SELECT COALESCE(json_agg(row_to_json(d) ORDER BY d.attempted_at DESC NULLS LAST), '[]'::json)
      FROM (
        SELECT id, subscription_id, charge_id, attempt_number, channel, status, error_message, attempted_at, created_at
        FROM dunning_attempts
        WHERE tenant_id = _tenant_id
        ORDER BY attempted_at DESC NULLS LAST
        LIMIT 20
      ) d
    ),
    'audit', (
      SELECT COALESCE(json_agg(row_to_json(a) ORDER BY a.created_at DESC), '[]'::json)
      FROM (
        SELECT id, action, details, created_at
        FROM super_admin_actions
        WHERE target_tenant_id = _tenant_id
          AND action IN ('change_subscription','extend_trial','suspend_subscription',
                         'reactivate_subscription','cancel_subscription','mark_payment_paid',
                         'retry_charge','replay_webhook')
        ORDER BY created_at DESC LIMIT 30
      ) a
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.super_admin_get_tenant_billing(uuid) TO authenticated;

-- 3. Global subscriptions listing
CREATE OR REPLACE FUNCTION public.super_admin_list_subscriptions(
  _status text DEFAULT NULL,
  _limit int DEFAULT 200
)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden: super_admin required' USING ERRCODE = 'P0403';
  END IF;

  RETURN (
    SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json) FROM (
      SELECT s.id, s.tenant_id, s.status::text, s.trial_ends_at,
             s.current_period_end, s.cancel_at_period_end, s.external_id,
             p.code AS plan_code, p.name AS plan_name, p.price_monthly,
             t.nome AS tenant_name, t.status::text AS tenant_status,
             (SELECT bc.status FROM billing_charges bc
               WHERE bc.tenant_id = s.tenant_id
               ORDER BY bc.created_at DESC LIMIT 1) AS last_charge_status,
             (SELECT bc.created_at FROM billing_charges bc
               WHERE bc.tenant_id = s.tenant_id
               ORDER BY bc.created_at DESC LIMIT 1) AS last_charge_at
      FROM subscriptions s
      JOIN plans p ON p.id = s.plan_id
      JOIN tenants t ON t.id = s.tenant_id
      WHERE (_status IS NULL OR s.status::text = _status)
      ORDER BY s.updated_at DESC
      LIMIT _limit
    ) r
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.super_admin_list_subscriptions(text, int) TO authenticated;

-- 4. Global webhook events listing
CREATE OR REPLACE FUNCTION public.super_admin_list_webhook_events(
  _provider text DEFAULT NULL,
  _status text DEFAULT NULL,
  _limit int DEFAULT 100
)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden: super_admin required' USING ERRCODE = 'P0403';
  END IF;

  RETURN (
    SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json) FROM (
      SELECT w.id, w.tenant_id, w.provider, w.provider_event_id, w.received_at,
             w.processed_at, w.status, w.error_message,
             (w.payload -> 'event') AS event_type,
             t.nome AS tenant_name
      FROM billing_webhook_events w
      LEFT JOIN tenants t ON t.id = w.tenant_id
      WHERE (_provider IS NULL OR w.provider = _provider)
        AND (_status IS NULL OR w.status = _status)
      ORDER BY w.received_at DESC
      LIMIT _limit
    ) r
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.super_admin_list_webhook_events(text, text, int) TO authenticated;
