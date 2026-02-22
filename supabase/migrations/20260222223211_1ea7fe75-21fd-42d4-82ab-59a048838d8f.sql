
-- Resync all deal counters to be max(deal_num)+1 per tenant
UPDATE public.tenant_counters tc
SET next_value = sub.nv,
    last_value = sub.nv - 1,
    updated_at = now()
FROM (
  SELECT tenant_id, COALESCE(MAX(deal_num), 0) + 1 AS nv
  FROM public.deals
  GROUP BY tenant_id
) sub
WHERE tc.tenant_id = sub.tenant_id AND tc.entity = 'deal';
