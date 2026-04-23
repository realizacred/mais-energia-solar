-- Limpar pipeline "Compesação" órfão (criado pela edge function bugada antes da correção)
DELETE FROM sm_etapa_stage_map
WHERE stage_id IN (
  SELECT ps.id FROM pipeline_stages ps
  JOIN pipelines p ON p.id = ps.pipeline_id
  WHERE p.id = 'db269865-8e75-4264-8c6d-75cb2fd1cc47'
);

DELETE FROM pipeline_stages
WHERE pipeline_id = 'db269865-8e75-4264-8c6d-75cb2fd1cc47';

DELETE FROM pipelines
WHERE id = 'db269865-8e75-4264-8c6d-75cb2fd1cc47';