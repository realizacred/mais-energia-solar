
-- 1. Move deals from LEAD to Comercial (first stage = Prospecção)
UPDATE deals
SET pipeline_id = '8b236b1e-68b6-4df7-8d3f-1cf4e9152600',
    stage_id = 'b5c518ff-9e73-41b2-b8de-c2e74de56a68'
WHERE pipeline_id = '0a496555-0a59-42e0-8b80-068054e44034'
AND tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41';

-- 2. Delete LEAD pipeline stages then pipeline
DELETE FROM pipeline_stages
WHERE pipeline_id = '0a496555-0a59-42e0-8b80-068054e44034';

DELETE FROM pipelines
WHERE id = '0a496555-0a59-42e0-8b80-068054e44034';

-- 3. Add missing stages to Comercial (SM LEAD stages)
INSERT INTO pipeline_stages (pipeline_id, name, position, tenant_id)
SELECT '8b236b1e-68b6-4df7-8d3f-1cf4e9152600', s.name, s.pos, '17de8315-2e2f-4a79-8751-e5d507d69a41'
FROM (VALUES
  ('Recebido', 0),
  ('Enviar Proposta', 7),
  ('Proposta enviada', 8),
  ('Fechado', 9)
) AS s(name, pos)
WHERE NOT EXISTS (
  SELECT 1 FROM pipeline_stages ps
  WHERE ps.pipeline_id = '8b236b1e-68b6-4df7-8d3f-1cf4e9152600'
  AND ps.name ILIKE s.name
);

-- 4. Add missing stages to Compesação
INSERT INTO pipeline_stages (pipeline_id, name, position, tenant_id)
SELECT p.id, s.name, s.pos, p.tenant_id
FROM pipelines p
CROSS JOIN (VALUES
  ('Recebido', 0),
  ('Compesação enviada', 1),
  ('Compesação aceita', 2)
) AS s(name, pos)
WHERE p.name ILIKE 'Compesação'
AND p.tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
AND NOT EXISTS (
  SELECT 1 FROM pipeline_stages ps
  WHERE ps.pipeline_id = p.id AND ps.name ILIKE s.name
);

-- 5. Add missing stages to Pagamento
INSERT INTO pipeline_stages (pipeline_id, name, position, tenant_id)
SELECT p.id, s.name, s.pos, p.tenant_id
FROM pipelines p
CROSS JOIN (VALUES ('Não Pago', 0), ('Pago', 1)) AS s(name, pos)
WHERE p.name ILIKE 'Pagamento'
AND p.tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
AND NOT EXISTS (
  SELECT 1 FROM pipeline_stages ps
  WHERE ps.pipeline_id = p.id AND ps.name ILIKE s.name
);

-- 6. Add missing stages to Engenharia
INSERT INTO pipeline_stages (pipeline_id, name, position, tenant_id)
SELECT p.id, s.name, s.pos, p.tenant_id
FROM pipelines p
CROSS JOIN (VALUES
  ('Elaboração do Projeto', 0),
  ('Pagamento TRT', 7)
) AS s(name, pos)
WHERE p.name ILIKE 'Engenharia'
AND p.tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
AND NOT EXISTS (
  SELECT 1 FROM pipeline_stages ps
  WHERE ps.pipeline_id = p.id AND ps.name ILIKE s.name
);

-- 7. Add missing stage to Equipamento
INSERT INTO pipeline_stages (pipeline_id, name, position, tenant_id)
SELECT p.id, 'Cliente', 8, p.tenant_id
FROM pipelines p
WHERE p.name ILIKE 'Equipamento'
AND p.tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
AND NOT EXISTS (
  SELECT 1 FROM pipeline_stages ps
  WHERE ps.pipeline_id = p.id AND ps.name ILIKE 'Cliente'
);
