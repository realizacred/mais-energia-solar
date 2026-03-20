-- Add missing columns and fix types for meter_status_latest
-- energy_total_kwh, counters, and change fault_bitmap/status to INTEGER

ALTER TABLE public.meter_status_latest 
  ADD COLUMN IF NOT EXISTS energy_total_kwh NUMERIC,
  ADD COLUMN IF NOT EXISTS over_current_count INTEGER,
  ADD COLUMN IF NOT EXISTS lost_current_count INTEGER,
  ADD COLUMN IF NOT EXISTS leak_count INTEGER;

-- Change fault_bitmap from TEXT to INTEGER (drop+add since ALTER COLUMN TYPE may fail with data)
ALTER TABLE public.meter_status_latest 
  ALTER COLUMN fault_bitmap TYPE INTEGER USING (NULLIF(fault_bitmap, '')::INTEGER),
  ALTER COLUMN status_a TYPE INTEGER USING (NULLIF(status_a, '')::INTEGER),
  ALTER COLUMN status_b TYPE INTEGER USING (NULLIF(status_b, '')::INTEGER),
  ALTER COLUMN status_c TYPE INTEGER USING (NULLIF(status_c, '')::INTEGER);