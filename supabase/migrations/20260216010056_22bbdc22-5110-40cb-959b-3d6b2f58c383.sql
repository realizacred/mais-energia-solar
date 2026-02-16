-- Add DNI (Direct Normal Irradiance) monthly columns
ALTER TABLE public.irradiance_points_monthly
  ADD COLUMN IF NOT EXISTS dni_m01 numeric,
  ADD COLUMN IF NOT EXISTS dni_m02 numeric,
  ADD COLUMN IF NOT EXISTS dni_m03 numeric,
  ADD COLUMN IF NOT EXISTS dni_m04 numeric,
  ADD COLUMN IF NOT EXISTS dni_m05 numeric,
  ADD COLUMN IF NOT EXISTS dni_m06 numeric,
  ADD COLUMN IF NOT EXISTS dni_m07 numeric,
  ADD COLUMN IF NOT EXISTS dni_m08 numeric,
  ADD COLUMN IF NOT EXISTS dni_m09 numeric,
  ADD COLUMN IF NOT EXISTS dni_m10 numeric,
  ADD COLUMN IF NOT EXISTS dni_m11 numeric,
  ADD COLUMN IF NOT EXISTS dni_m12 numeric;