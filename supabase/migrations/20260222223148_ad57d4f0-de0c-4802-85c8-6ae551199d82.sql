
-- Direct fix: set deal counter to correct value (next after max deal_num=1 is 2)
UPDATE public.tenant_counters 
SET next_value = 2, last_value = 1, updated_at = now()
WHERE tenant_id = '00000000-0000-0000-0000-000000000001' AND entity = 'deal';
