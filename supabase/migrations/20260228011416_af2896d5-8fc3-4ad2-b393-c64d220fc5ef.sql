
-- Backfill: resolve sm_client_id on proposals from their linked project
UPDATE solar_market_proposals p
SET sm_client_id = proj.sm_client_id
FROM solar_market_projects proj
WHERE proj.sm_project_id = p.sm_project_id
  AND proj.tenant_id = p.tenant_id
  AND proj.sm_client_id IS NOT NULL
  AND (p.sm_client_id IS NULL OR p.sm_client_id = -1);
