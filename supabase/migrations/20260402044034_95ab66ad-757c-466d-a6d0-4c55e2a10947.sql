-- Repair tenant_counters for 'projeto' entity after SM migration
-- The next_tenant_number function has auto-repair, but the counter row
-- may have been incremented in a concurrent transaction, causing collision.
-- This ensures all counters are ahead of the actual MAX values.

UPDATE public.tenant_counters tc
SET next_value = sub.correct_next,
    last_value = sub.correct_next - 1,
    updated_at = now()
FROM (
  SELECT 
    p.tenant_id,
    GREATEST(
      COALESCE((SELECT MAX(projeto_num) FROM projetos WHERE tenant_id = p.tenant_id), 0) + 1,
      COALESCE(tc2.next_value, 1)
    ) AS correct_next
  FROM (SELECT DISTINCT tenant_id FROM projetos) p
  LEFT JOIN tenant_counters tc2 ON tc2.tenant_id = p.tenant_id AND tc2.entity = 'projeto'
) sub
WHERE tc.tenant_id = sub.tenant_id
  AND tc.entity = 'projeto'
  AND tc.next_value < sub.correct_next;

-- Also repair 'deal' and 'proposta' counters preventively
UPDATE public.tenant_counters tc
SET next_value = sub.correct_next,
    last_value = sub.correct_next - 1,
    updated_at = now()
FROM (
  SELECT 
    d.tenant_id,
    GREATEST(
      COALESCE((SELECT MAX(deal_num) FROM deals WHERE tenant_id = d.tenant_id), 0) + 1,
      COALESCE(tc2.next_value, 1)
    ) AS correct_next
  FROM (SELECT DISTINCT tenant_id FROM deals) d
  LEFT JOIN tenant_counters tc2 ON tc2.tenant_id = d.tenant_id AND tc2.entity = 'deal'
) sub
WHERE tc.tenant_id = sub.tenant_id
  AND tc.entity = 'deal'
  AND tc.next_value < sub.correct_next;

UPDATE public.tenant_counters tc
SET next_value = sub.correct_next,
    last_value = sub.correct_next - 1,
    updated_at = now()
FROM (
  SELECT 
    pn.tenant_id,
    GREATEST(
      COALESCE((SELECT MAX(proposta_num) FROM propostas_nativas WHERE tenant_id = pn.tenant_id), 0) + 1,
      COALESCE(tc2.next_value, 1)
    ) AS correct_next
  FROM (SELECT DISTINCT tenant_id FROM propostas_nativas) pn
  LEFT JOIN tenant_counters tc2 ON tc2.tenant_id = pn.tenant_id AND tc2.entity = 'proposta'
) sub
WHERE tc.tenant_id = sub.tenant_id
  AND tc.entity = 'proposta'
  AND tc.next_value < sub.correct_next;