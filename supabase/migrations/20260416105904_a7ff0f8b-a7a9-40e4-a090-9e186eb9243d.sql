
-- Step 1: Create deal_pipeline_stages for Commercial pipeline
-- Map projeto_etapas stages to pipeline_stages by name
WITH stage_map AS (
  SELECT 
    pe.id as projeto_etapa_id,
    ps.id as pipeline_stage_id,
    pe.nome
  FROM projeto_etapas pe
  JOIN pipeline_stages ps ON ps.name = pe.nome AND ps.pipeline_id = 'ea4aacc0-b75a-4573-bce6-8006dd27a8be'
  WHERE pe.funil_id = 'aa5a0a3f-36f5-4112-8825-f6e811f51be0'
),
projects_to_sync AS (
  SELECT 
    d.id as deal_id,
    p.etapa_id as projeto_etapa_id,
    p.tenant_id
  FROM projetos p
  JOIN deals d ON d.projeto_id = p.id
  WHERE p.funil_id = 'aa5a0a3f-36f5-4112-8825-f6e811f51be0'
  AND NOT EXISTS (
    SELECT 1 FROM deal_pipeline_stages dps
    WHERE dps.deal_id = d.id
    AND dps.pipeline_id = 'ea4aacc0-b75a-4573-bce6-8006dd27a8be'
  )
)
INSERT INTO deal_pipeline_stages (deal_id, pipeline_id, stage_id, tenant_id)
SELECT 
  pts.deal_id,
  'ea4aacc0-b75a-4573-bce6-8006dd27a8be',
  COALESCE(sm.pipeline_stage_id, 'b6809e1c-5622-421a-bca4-20c449bd47d9'), -- default to Recebido
  pts.tenant_id
FROM projects_to_sync pts
LEFT JOIN stage_map sm ON sm.projeto_etapa_id = pts.projeto_etapa_id
ON CONFLICT DO NOTHING;

-- Step 2: Fix projects with rejected proposals stuck in "Recebido" stage
-- Move them to "Fechado" in both pipeline systems
-- First in deal_pipeline_stages (Commercial pipeline)
UPDATE deal_pipeline_stages dps
SET stage_id = '3c5a1518-9f5b-44fd-8e60-19454fb8b0f4' -- Fechado in pipeline_stages
FROM deals d
JOIN projetos p ON p.id = d.projeto_id
JOIN propostas_nativas pn ON pn.deal_id = d.id AND pn.is_principal = true
WHERE dps.deal_id = d.id
AND dps.pipeline_id = 'ea4aacc0-b75a-4573-bce6-8006dd27a8be'
AND dps.stage_id = 'b6809e1c-5622-421a-bca4-20c449bd47d9' -- stuck in Recebido
AND pn.status IN ('recusada', 'rejected', 'perdida');

-- Also fix in projetos table (projeto_etapas system)
UPDATE projetos p
SET etapa_id = '1cc32fbd-66f5-4dd9-a462-c06b130f91e9' -- Fechado in projeto_etapas
FROM propostas_nativas pn
WHERE pn.deal_id = (SELECT d.id FROM deals d WHERE d.projeto_id = p.id LIMIT 1)
AND pn.is_principal = true
AND p.funil_id = 'aa5a0a3f-36f5-4112-8825-f6e811f51be0'
AND p.etapa_id = 'c09472e8-2fc6-4a04-8bd3-1f6afe7ac6aa' -- Recebido in projeto_etapas
AND pn.status IN ('recusada', 'rejected', 'perdida');
