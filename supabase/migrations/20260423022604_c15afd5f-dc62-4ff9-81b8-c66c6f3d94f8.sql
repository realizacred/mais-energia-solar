
-- Limpar pipeline "Compesação" órfão criado pela edge function bugada
DELETE FROM sm_etapa_stage_map
WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
  AND stage_id IN (
    SELECT ps.id FROM pipeline_stages ps
    JOIN pipelines p ON p.id = ps.pipeline_id
    WHERE p.name = 'Compesação' AND p.tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
  );

DELETE FROM pipeline_stages
WHERE pipeline_id IN (
  SELECT id FROM pipelines
  WHERE name = 'Compesação' AND tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
);

DELETE FROM pipelines
WHERE name = 'Compesação' AND tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41';
