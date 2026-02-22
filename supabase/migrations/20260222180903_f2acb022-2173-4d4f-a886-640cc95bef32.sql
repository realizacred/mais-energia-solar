
-- Update sync_deal_kanban_projection to include deal_num
CREATE OR REPLACE FUNCTION public.sync_deal_kanban_projection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO deal_kanban_projection (
    deal_id, tenant_id, pipeline_id, stage_id, stage_name,
    stage_position, owner_id, owner_name, customer_name, customer_phone,
    deal_title, deal_value, deal_kwp, deal_status, stage_probability,
    etiqueta, last_stage_change, updated_at, cliente_code, deal_num
  )
  SELECT
    NEW.id, NEW.tenant_id, NEW.pipeline_id, NEW.stage_id,
    COALESCE(ps.name, '—'), COALESCE(ps.position, 0), NEW.owner_id,
    COALESCE(c.nome, ''), COALESCE(cl.nome, ''),
    COALESCE(cl.telefone, ''),
    NEW.title, NEW.value, COALESCE(NEW.kwp, 0), NEW.status, COALESCE(ps.probability, 0),
    NEW.etiqueta,
    now(), now(),
    cl.cliente_code,
    NEW.deal_num
  FROM (SELECT 1) AS _dummy
  LEFT JOIN pipeline_stages ps ON ps.id = NEW.stage_id
  LEFT JOIN consultores c ON c.id = NEW.owner_id
  LEFT JOIN clientes cl ON cl.id = NEW.customer_id
  ON CONFLICT (deal_id) DO UPDATE SET
    pipeline_id = EXCLUDED.pipeline_id,
    stage_id = EXCLUDED.stage_id,
    stage_name = EXCLUDED.stage_name,
    stage_position = EXCLUDED.stage_position,
    owner_id = EXCLUDED.owner_id,
    owner_name = EXCLUDED.owner_name,
    customer_name = EXCLUDED.customer_name,
    customer_phone = EXCLUDED.customer_phone,
    deal_title = EXCLUDED.deal_title,
    deal_value = EXCLUDED.deal_value,
    deal_kwp = EXCLUDED.deal_kwp,
    deal_status = EXCLUDED.deal_status,
    stage_probability = EXCLUDED.stage_probability,
    etiqueta = EXCLUDED.etiqueta,
    cliente_code = EXCLUDED.cliente_code,
    deal_num = EXCLUDED.deal_num,
    last_stage_change = CASE 
      WHEN deal_kanban_projection.stage_id IS DISTINCT FROM EXCLUDED.stage_id 
      THEN now() ELSE deal_kanban_projection.last_stage_change 
    END,
    updated_at = now();
  RETURN NEW;
END;
$$;

-- Create RPC to resolve deal by num (for URL routing)
CREATE OR REPLACE FUNCTION public.resolve_deal_id_by_num(p_tenant_id uuid, p_deal_num bigint)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.deals WHERE tenant_id = p_tenant_id AND deal_num = p_deal_num LIMIT 1;
$$;
