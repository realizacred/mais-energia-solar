
-- Add cliente_code to deal_kanban_projection
ALTER TABLE public.deal_kanban_projection ADD COLUMN IF NOT EXISTS cliente_code TEXT;

-- Update sync trigger to include cliente_code
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
    deal_title, deal_value, deal_kwp, deal_status, stage_probability,
    etiqueta, last_stage_change, updated_at, cliente_code
  )
  SELECT
    NEW.id, NEW.tenant_id, NEW.pipeline_id, NEW.stage_id,
    COALESCE(ps.name, '—'), COALESCE(ps.position, 0), NEW.owner_id,
    COALESCE(c.nome, ''), COALESCE(cl.nome, ''),
    COALESCE(cl.telefone, ''),
    NEW.title, NEW.value, COALESCE(NEW.kwp, 0), NEW.status, COALESCE(ps.probability, 0),
    NEW.etiqueta,
    now(), now(),
    cl.cliente_code
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
    last_stage_change = CASE 
      WHEN deal_kanban_projection.stage_id IS DISTINCT FROM EXCLUDED.stage_id 
      THEN now() ELSE deal_kanban_projection.last_stage_change 
    END,
    updated_at = now();
  RETURN NEW;
END;
$function$;

-- Backfill existing projection rows with cliente_code
UPDATE deal_kanban_projection dkp
SET cliente_code = cl.cliente_code
FROM deals d
JOIN clientes cl ON cl.id = d.customer_id
WHERE dkp.deal_id = d.id AND dkp.cliente_code IS NULL;
