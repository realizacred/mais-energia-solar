-- Fix: sm_proposal_id is per-project, not globally unique.
-- Need composite unique on (tenant_id, sm_project_id, sm_proposal_id)

-- First drop the old constraint
ALTER TABLE public.solar_market_proposals 
  DROP CONSTRAINT solar_market_proposals_tenant_id_sm_proposal_id_key;

-- Ensure sm_project_id is NOT NULL for the new constraint to work
-- Update any existing rows that have null sm_project_id
UPDATE public.solar_market_proposals 
SET sm_project_id = (raw_payload->'project'->>'id')::int 
WHERE sm_project_id IS NULL AND raw_payload->'project'->>'id' IS NOT NULL;

-- Add new composite unique constraint
ALTER TABLE public.solar_market_proposals 
  ADD CONSTRAINT solar_market_proposals_tenant_project_proposal_key 
  UNIQUE (tenant_id, sm_project_id, sm_proposal_id);