
-- 1) Add empresa to clientes
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS empresa text;

-- 2) Add etiqueta and notas to deals
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS etiqueta text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS notas text;

-- 3) Add customer_phone and etiqueta to deal_kanban_projection
ALTER TABLE public.deal_kanban_projection ADD COLUMN IF NOT EXISTS customer_phone text DEFAULT '';
ALTER TABLE public.deal_kanban_projection ADD COLUMN IF NOT EXISTS etiqueta text;

-- 4) Update the sync trigger to include customer_phone and etiqueta
CREATE OR REPLACE FUNCTION public.sync_deal_kanban_projection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO deal_kanban_projection (
    deal_id, tenant_id, pipeline_id, stage_id, stage_name,
    stage_position, owner_id, owner_name, customer_name, customer_phone,
    deal_title, deal_value, deal_status, stage_probability,
    etiqueta, last_stage_change, updated_at
  )
  SELECT
    NEW.id, NEW.tenant_id, NEW.pipeline_id, NEW.stage_id,
    ps.name, ps.position, NEW.owner_id,
    COALESCE(c.nome, ''), COALESCE(cl.nome, ''),
    COALESCE(cl.telefone, ''),
    NEW.title, NEW.value, NEW.status, ps.probability,
    NEW.etiqueta,
    now(), now()
  FROM pipeline_stages ps
  LEFT JOIN consultores c ON c.id = NEW.owner_id
  LEFT JOIN clientes cl ON cl.id = NEW.customer_id
  WHERE ps.id = NEW.stage_id
  ON CONFLICT (deal_id) DO UPDATE SET
    stage_id = EXCLUDED.stage_id,
    stage_name = EXCLUDED.stage_name,
    stage_position = EXCLUDED.stage_position,
    owner_id = EXCLUDED.owner_id,
    owner_name = EXCLUDED.owner_name,
    customer_name = EXCLUDED.customer_name,
    customer_phone = EXCLUDED.customer_phone,
    deal_title = EXCLUDED.deal_title,
    deal_value = EXCLUDED.deal_value,
    deal_status = EXCLUDED.deal_status,
    stage_probability = EXCLUDED.stage_probability,
    etiqueta = EXCLUDED.etiqueta,
    last_stage_change = CASE 
      WHEN deal_kanban_projection.stage_id != EXCLUDED.stage_id 
      THEN now() ELSE deal_kanban_projection.last_stage_change 
    END,
    updated_at = now();
  RETURN NEW;
END;
$function$;
