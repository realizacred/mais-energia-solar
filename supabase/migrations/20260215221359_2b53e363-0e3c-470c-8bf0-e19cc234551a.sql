
-- Step 1: Add DHI columns to irradiance_points_monthly
ALTER TABLE public.irradiance_points_monthly
  ADD COLUMN IF NOT EXISTS dhi_m01 numeric,
  ADD COLUMN IF NOT EXISTS dhi_m02 numeric,
  ADD COLUMN IF NOT EXISTS dhi_m03 numeric,
  ADD COLUMN IF NOT EXISTS dhi_m04 numeric,
  ADD COLUMN IF NOT EXISTS dhi_m05 numeric,
  ADD COLUMN IF NOT EXISTS dhi_m06 numeric,
  ADD COLUMN IF NOT EXISTS dhi_m07 numeric,
  ADD COLUMN IF NOT EXISTS dhi_m08 numeric,
  ADD COLUMN IF NOT EXISTS dhi_m09 numeric,
  ADD COLUMN IF NOT EXISTS dhi_m10 numeric,
  ADD COLUMN IF NOT EXISTS dhi_m11 numeric,
  ADD COLUMN IF NOT EXISTS dhi_m12 numeric;
