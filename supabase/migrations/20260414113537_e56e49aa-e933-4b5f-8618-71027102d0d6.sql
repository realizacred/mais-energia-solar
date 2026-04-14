
-- Fix Comercial pipeline stages to match proposal lifecycle

-- 1. Rename "Fechado" to "Ganho" and set proper flags
UPDATE pipeline_stages 
SET name = 'Ganho', is_won = true, is_closed = true, probability = 100
WHERE pipeline_id = '08404115-6b9f-4949-84da-9061e1689dac' 
  AND name = 'Fechado';

-- 2. Update probabilities on existing stages
UPDATE pipeline_stages SET probability = 10 
WHERE pipeline_id = '08404115-6b9f-4949-84da-9061e1689dac' AND name = 'Recebido';

UPDATE pipeline_stages SET probability = 20 
WHERE pipeline_id = '08404115-6b9f-4949-84da-9061e1689dac' AND name = 'Enviar Proposta';

UPDATE pipeline_stages SET probability = 40 
WHERE pipeline_id = '08404115-6b9f-4949-84da-9061e1689dac' AND name = 'Proposta enviada';

UPDATE pipeline_stages SET probability = 50 
WHERE pipeline_id = '08404115-6b9f-4949-84da-9061e1689dac' AND name = 'Qualificado';

UPDATE pipeline_stages SET probability = 70 
WHERE pipeline_id = '08404115-6b9f-4949-84da-9061e1689dac' AND name = 'Negociação';

-- 3. Add "Perdido" stage (terminal, closed, not won)
INSERT INTO pipeline_stages (pipeline_id, tenant_id, name, position, probability, is_closed, is_won)
SELECT 
  '08404115-6b9f-4949-84da-9061e1689dac',
  p.tenant_id,
  'Perdido',
  6,
  0,
  true,
  false
FROM pipelines p 
WHERE p.id = '08404115-6b9f-4949-84da-9061e1689dac'
ON CONFLICT DO NOTHING;

-- 4. Rebuild kanban projection for affected deals (Comercial pipeline)
-- This ensures the renamed stage appears correctly
UPDATE deal_kanban_projection dkp
SET stage_name = ps.name, stage_probability = ps.probability
FROM pipeline_stages ps
WHERE dkp.stage_id = ps.id 
  AND dkp.pipeline_id = '08404115-6b9f-4949-84da-9061e1689dac';
