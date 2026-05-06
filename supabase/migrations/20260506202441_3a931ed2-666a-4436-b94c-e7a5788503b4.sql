
UPDATE public.subscriptions s
SET status = 'active'::subscription_status,
    trial_ends_at = NULL,
    current_period_start = COALESCE(current_period_start, now()),
    current_period_end = GREATEST(COALESCE(current_period_end, now()), now() + interval '30 days'),
    updated_at = now()
FROM public.tenants t
WHERE s.tenant_id = t.id
  AND t.status = 'active'
  AND lower(t.plano) <> 'free'
  AND s.status = 'trialing';
