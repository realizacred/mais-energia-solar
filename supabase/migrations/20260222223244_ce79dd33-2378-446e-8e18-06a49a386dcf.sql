
-- Force correct counter value: next deal for this tenant should be 2
-- (deal_num=1 already exists)
DO $$
BEGIN
  UPDATE public.tenant_counters
  SET next_value = 2, last_value = 1
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001' AND entity = 'deal';
END $$;
