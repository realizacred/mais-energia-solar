
-- Add missing columns to solar_market_clients
ALTER TABLE public.solar_market_clients
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS zip_code TEXT,
  ADD COLUMN IF NOT EXISTS number TEXT,
  ADD COLUMN IF NOT EXISTS complement TEXT,
  ADD COLUMN IF NOT EXISTS company TEXT,
  ADD COLUMN IF NOT EXISTS secondary_phone TEXT,
  ADD COLUMN IF NOT EXISTS representative JSONB,
  ADD COLUMN IF NOT EXISTS responsible JSONB,
  ADD COLUMN IF NOT EXISTS sm_created_at TIMESTAMPTZ;
