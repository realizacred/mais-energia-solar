
-- Add comprehensive columns to solar_market_projects
ALTER TABLE public.solar_market_projects
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS zip_code TEXT,
  ADD COLUMN IF NOT EXISTS number TEXT,
  ADD COLUMN IF NOT EXISTS complement TEXT,
  ADD COLUMN IF NOT EXISTS installation_type TEXT,
  ADD COLUMN IF NOT EXISTS phase_type TEXT,
  ADD COLUMN IF NOT EXISTS voltage TEXT,
  ADD COLUMN IF NOT EXISTS energy_consumption NUMERIC,
  ADD COLUMN IF NOT EXISTS representative JSONB,
  ADD COLUMN IF NOT EXISTS responsible JSONB,
  ADD COLUMN IF NOT EXISTS sm_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sm_updated_at TIMESTAMPTZ;

-- Add comprehensive columns to solar_market_proposals
ALTER TABLE public.solar_market_proposals
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS discount NUMERIC,
  ADD COLUMN IF NOT EXISTS installation_cost NUMERIC,
  ADD COLUMN IF NOT EXISTS equipment_cost NUMERIC,
  ADD COLUMN IF NOT EXISTS energy_generation NUMERIC,
  ADD COLUMN IF NOT EXISTS roof_type TEXT,
  ADD COLUMN IF NOT EXISTS panel_model TEXT,
  ADD COLUMN IF NOT EXISTS panel_quantity INTEGER,
  ADD COLUMN IF NOT EXISTS inverter_model TEXT,
  ADD COLUMN IF NOT EXISTS inverter_quantity INTEGER,
  ADD COLUMN IF NOT EXISTS structure_type TEXT,
  ADD COLUMN IF NOT EXISTS warranty TEXT,
  ADD COLUMN IF NOT EXISTS payment_conditions TEXT,
  ADD COLUMN IF NOT EXISTS sm_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sm_updated_at TIMESTAMPTZ;
