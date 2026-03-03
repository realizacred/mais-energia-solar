-- Fix: Reset energy_kwh for 2026-03-03 records that were incorrectly
-- written with previous day's energy due to UTC/BRT timezone mismatch.
-- These records were created before sunrise on 03/03 with stale energy values.
UPDATE solar_plant_metrics_daily
SET energy_kwh = NULL, power_kw = 0
WHERE date = '2026-03-03'
  AND energy_kwh > 0
  AND created_at < '2026-03-03T06:00:00+00:00';