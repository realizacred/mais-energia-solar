-- Add expanded DP columns to meter_status_latest
ALTER TABLE public.meter_status_latest ADD COLUMN IF NOT EXISTS reactive_power_kvar NUMERIC;
ALTER TABLE public.meter_status_latest ADD COLUMN IF NOT EXISTS power_factor NUMERIC;
ALTER TABLE public.meter_status_latest ADD COLUMN IF NOT EXISTS leakage_current_ma NUMERIC;
ALTER TABLE public.meter_status_latest ADD COLUMN IF NOT EXISTS neutral_current_a NUMERIC;
ALTER TABLE public.meter_status_latest ADD COLUMN IF NOT EXISTS temperature_c NUMERIC;
ALTER TABLE public.meter_status_latest ADD COLUMN IF NOT EXISTS energy_balance_kwh NUMERIC;
ALTER TABLE public.meter_status_latest ADD COLUMN IF NOT EXISTS status_a TEXT;
ALTER TABLE public.meter_status_latest ADD COLUMN IF NOT EXISTS status_b TEXT;
ALTER TABLE public.meter_status_latest ADD COLUMN IF NOT EXISTS status_c TEXT;
ALTER TABLE public.meter_status_latest ADD COLUMN IF NOT EXISTS fault_bitmap TEXT;