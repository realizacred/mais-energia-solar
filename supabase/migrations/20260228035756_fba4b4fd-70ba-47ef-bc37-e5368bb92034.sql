-- Add all_funnels column to store ALL funnels per project (not just one)
ALTER TABLE public.solar_market_projects 
  ADD COLUMN IF NOT EXISTS all_funnels JSONB DEFAULT NULL;

COMMENT ON COLUMN public.solar_market_projects.all_funnels IS 'Array of all funnels this project belongs to [{funnelId, funnelName, stageId, stageName}]';