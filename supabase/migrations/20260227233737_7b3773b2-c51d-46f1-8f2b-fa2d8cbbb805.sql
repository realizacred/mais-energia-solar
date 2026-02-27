
-- Backfill sm_client_id em projetos usando raw_payload->'client'->>'id'
UPDATE solar_market_projects
SET sm_client_id = (raw_payload->'client'->>'id')::bigint
WHERE sm_client_id IS NULL
  AND raw_payload->'client'->>'id' IS NOT NULL;

-- Backfill sm_client_id em propostas usando projetos já corrigidos
UPDATE solar_market_proposals pr
SET sm_client_id = p.sm_client_id
FROM solar_market_projects p
WHERE pr.sm_project_id = p.sm_project_id
  AND pr.tenant_id = p.tenant_id
  AND p.sm_client_id IS NOT NULL
  AND (pr.sm_client_id IS NULL OR pr.sm_client_id = -1);
