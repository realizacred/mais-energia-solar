
CREATE OR REPLACE FUNCTION public.next_tenant_number(p_tenant_id uuid, p_entity text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_next bigint;
  v_max bigint;
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

  -- Auto-repair: check if v_next would collide with existing data
  SELECT COALESCE(
    CASE p_entity
      WHEN 'deal' THEN (SELECT MAX(deal_num) FROM deals WHERE tenant_id = p_tenant_id)
      WHEN 'proposta' THEN (SELECT MAX(proposta_num) FROM propostas_nativas WHERE tenant_id = p_tenant_id)
      WHEN 'projeto' THEN (SELECT MAX(projeto_num) FROM projetos WHERE tenant_id = p_tenant_id)
      WHEN 'cliente' THEN (SELECT MAX(NULLIF(regexp_replace(cliente_code, '[^0-9]', '', 'g'), '')::bigint) FROM clientes WHERE tenant_id = p_tenant_id)
      ELSE NULL
    END, 0
  ) INTO v_max;

  -- If counter is behind or invalid, repair it
  IF v_next <= v_max THEN
    v_next := v_max + 1;
  END IF;

  -- Increment
  UPDATE public.tenant_counters
  SET last_value = v_next,
      next_value = v_next + 1,
      updated_at = now()
  WHERE tenant_id = p_tenant_id AND entity = p_entity;

  RETURN v_next;
END;
$function$;
