
-- Fix 1: Reset deal counter that was incorrectly initialized with next_value=0
-- This is a data fix required because the counter was pre-seeded with wrong initial value
UPDATE public.tenant_counters 
SET next_value = GREATEST(
      (SELECT COALESCE(MAX(deal_num), 0) + 1 FROM public.deals d WHERE d.tenant_id = tenant_counters.tenant_id), 
      1
    ),
    last_value = GREATEST(
      (SELECT COALESCE(MAX(deal_num), 0) FROM public.deals d WHERE d.tenant_id = tenant_counters.tenant_id), 
      0
    ),
    updated_at = now()
WHERE entity = 'deal' AND next_value < 1;

-- Fix 2: Update existing deal with deal_num=0 to deal_num=1 (invalid value)
UPDATE public.deals SET deal_num = 1 WHERE deal_num = 0;

-- Fix 3: Harden next_tenant_number to guarantee next_value >= 1
CREATE OR REPLACE FUNCTION public.next_tenant_number(p_tenant_id uuid, p_entity text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_next bigint;
BEGIN
  -- Upsert: ensure row exists with next_value starting at 1
  INSERT INTO public.tenant_counters (tenant_id, entity, next_value, last_value, updated_at)
  VALUES (p_tenant_id, p_entity, 1, 0, now())
  ON CONFLICT (tenant_id, entity) DO NOTHING;

  -- Lock and read
  SELECT next_value INTO v_next
  FROM public.tenant_counters
  WHERE tenant_id = p_tenant_id AND entity = p_entity
  FOR UPDATE;

  -- Safety: if somehow next_value < 1, auto-repair from max existing value
  IF v_next < 1 THEN
    SELECT COALESCE(MAX(
      CASE p_entity
        WHEN 'deal' THEN (SELECT MAX(deal_num) FROM deals WHERE tenant_id = p_tenant_id)
        WHEN 'proposta' THEN (SELECT MAX(proposta_num) FROM propostas_nativas WHERE tenant_id = p_tenant_id)
        ELSE 0
      END
    ), 0) + 1 INTO v_next;
  END IF;

  -- Increment
  UPDATE public.tenant_counters
  SET last_value = v_next,
      next_value = v_next + 1,
      updated_at = now()
  WHERE tenant_id = p_tenant_id AND entity = p_entity;

  RETURN v_next;
END;
$$;
