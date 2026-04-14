
-- Step 1: Clean orphans
DELETE FROM deal_kanban_projection 
WHERE deal_id NOT IN (SELECT id FROM deals);

-- Step 2: Drop existing constraints
ALTER TABLE deal_kanban_projection
DROP CONSTRAINT IF EXISTS deal_kanban_projection_deal_id_fkey;

ALTER TABLE deal_kanban_projection
DROP CONSTRAINT IF EXISTS deal_kanban_projection_pkey;

-- Step 3: Add composite PK
ALTER TABLE deal_kanban_projection
ADD PRIMARY KEY (deal_id, pipeline_id);

-- Step 4: Re-add FK
ALTER TABLE deal_kanban_projection
ADD CONSTRAINT deal_kanban_projection_deal_id_fkey
  FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;

-- Step 5: Update sync function for deals trigger
CREATE OR REPLACE FUNCTION sync_deal_kanban_projection()
RETURNS TRIGGER
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
    NEW.etiqueta, now(), now(), cl.cliente_code, NEW.deal_num
  FROM (SELECT 1) AS _dummy
  LEFT JOIN pipeline_stages ps ON ps.id = NEW.stage_id
  LEFT JOIN consultores c ON c.id = NEW.owner_id
  LEFT JOIN clientes cl ON cl.id = NEW.customer_id
  ON CONFLICT (deal_id, pipeline_id) DO UPDATE SET
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

  -- Also update all secondary pipeline rows when deal data changes
  UPDATE deal_kanban_projection dkp SET
    owner_id = NEW.owner_id,
    owner_name = COALESCE(c.nome, ''),
    customer_name = COALESCE(cl.nome, ''),
    customer_phone = COALESCE(cl.telefone, ''),
    deal_title = NEW.title,
    deal_value = NEW.value,
    deal_kwp = COALESCE(NEW.kwp, 0),
    deal_status = NEW.status,
    etiqueta = NEW.etiqueta,
    cliente_code = cl.cliente_code,
    deal_num = NEW.deal_num,
    updated_at = now()
  FROM (SELECT 1) AS _d
  LEFT JOIN consultores c ON c.id = NEW.owner_id
  LEFT JOIN clientes cl ON cl.id = NEW.customer_id
  WHERE dkp.deal_id = NEW.id AND dkp.pipeline_id != NEW.pipeline_id;

  RETURN NEW;
END;
$$;

-- Step 6: Create sync function for deal_pipeline_stages
CREATE OR REPLACE FUNCTION sync_dps_kanban_projection()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deal deals%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM deal_kanban_projection
    WHERE deal_id = OLD.deal_id AND pipeline_id = OLD.pipeline_id;
    RETURN OLD;
  END IF;

  SELECT * INTO v_deal FROM deals WHERE id = NEW.deal_id;
  IF v_deal.id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO deal_kanban_projection (
    deal_id, tenant_id, pipeline_id, stage_id, stage_name,
    stage_position, owner_id, owner_name, customer_name, customer_phone,
    deal_title, deal_value, deal_kwp, deal_status, stage_probability,
    etiqueta, last_stage_change, updated_at, cliente_code, deal_num
  )
  SELECT
    v_deal.id, v_deal.tenant_id, NEW.pipeline_id, NEW.stage_id,
    COALESCE(ps.name, '—'), COALESCE(ps.position, 0), v_deal.owner_id,
    COALESCE(c.nome, ''), COALESCE(cl.nome, ''),
    COALESCE(cl.telefone, ''),
    v_deal.title, v_deal.value, COALESCE(v_deal.kwp, 0), v_deal.status, COALESCE(ps.probability, 0),
    v_deal.etiqueta, now(), now(), cl.cliente_code, v_deal.deal_num
  FROM (SELECT 1) AS _dummy
  LEFT JOIN pipeline_stages ps ON ps.id = NEW.stage_id
  LEFT JOIN consultores c ON c.id = v_deal.owner_id
  LEFT JOIN clientes cl ON cl.id = v_deal.customer_id
  ON CONFLICT (deal_id, pipeline_id) DO UPDATE SET
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

-- Step 7: Create trigger on deal_pipeline_stages
DROP TRIGGER IF EXISTS trg_sync_dps_kanban ON deal_pipeline_stages;
CREATE TRIGGER trg_sync_dps_kanban
  AFTER INSERT OR UPDATE OR DELETE ON deal_pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION sync_dps_kanban_projection();

-- Step 8: Rebuild projection
TRUNCATE deal_kanban_projection;

-- Primary pipeline from deals
INSERT INTO deal_kanban_projection (
  deal_id, tenant_id, pipeline_id, stage_id, stage_name,
  stage_position, owner_id, owner_name, customer_name, customer_phone,
  deal_title, deal_value, deal_kwp, deal_status, stage_probability,
  etiqueta, last_stage_change, updated_at, cliente_code, deal_num
)
SELECT
  d.id, d.tenant_id, d.pipeline_id, d.stage_id,
  COALESCE(ps.name, '—'), COALESCE(ps.position, 0), d.owner_id,
  COALESCE(c.nome, ''), COALESCE(cl.nome, ''),
  COALESCE(cl.telefone, ''),
  d.title, d.value, COALESCE(d.kwp, 0), d.status, COALESCE(ps.probability, 0),
  d.etiqueta, COALESCE(d.updated_at, now()), now(),
  cl.cliente_code, d.deal_num
FROM deals d
LEFT JOIN pipeline_stages ps ON ps.id = d.stage_id
LEFT JOIN consultores c ON c.id = d.owner_id
LEFT JOIN clientes cl ON cl.id = d.customer_id;

-- Secondary pipelines from deal_pipeline_stages
INSERT INTO deal_kanban_projection (
  deal_id, tenant_id, pipeline_id, stage_id, stage_name,
  stage_position, owner_id, owner_name, customer_name, customer_phone,
  deal_title, deal_value, deal_kwp, deal_status, stage_probability,
  etiqueta, last_stage_change, updated_at, cliente_code, deal_num
)
SELECT
  d.id, d.tenant_id, dps.pipeline_id, dps.stage_id,
  COALESCE(ps.name, '—'), COALESCE(ps.position, 0), d.owner_id,
  COALESCE(c.nome, ''), COALESCE(cl.nome, ''),
  COALESCE(cl.telefone, ''),
  d.title, d.value, COALESCE(d.kwp, 0), d.status, COALESCE(ps.probability, 0),
  d.etiqueta, COALESCE(dps.updated_at, now()), now(),
  cl.cliente_code, d.deal_num
FROM deal_pipeline_stages dps
JOIN deals d ON d.id = dps.deal_id
LEFT JOIN pipeline_stages ps ON ps.id = dps.stage_id
LEFT JOIN consultores c ON c.id = d.owner_id
LEFT JOIN clientes cl ON cl.id = d.customer_id
ON CONFLICT (deal_id, pipeline_id) DO UPDATE SET
  stage_id = EXCLUDED.stage_id,
  stage_name = EXCLUDED.stage_name,
  stage_position = EXCLUDED.stage_position,
  updated_at = now();
