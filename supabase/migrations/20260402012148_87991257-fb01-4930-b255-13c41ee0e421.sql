
ALTER TABLE solar_market_projects
  ADD COLUMN IF NOT EXISTS has_active_proposal boolean DEFAULT true;

-- Backfill: mark projects without a matching proposal as false
UPDATE solar_market_projects sp
SET has_active_proposal = false
WHERE NOT EXISTS (
  SELECT 1 FROM solar_market_proposals smp
  WHERE smp.sm_project_id = sp.sm_project_id
    AND smp.tenant_id = sp.tenant_id
);
