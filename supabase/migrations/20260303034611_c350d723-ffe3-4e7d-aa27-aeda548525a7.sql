-- Fix Huawei capacity: stored in MW, should be kWp (× 1000)
UPDATE solar_plants
SET capacity_kw = capacity_kw * 1000,
    updated_at = now()
WHERE provider = 'huawei_fusionsolar'
  AND capacity_kw > 0
  AND capacity_kw < 1; -- Only fix values that are clearly in MW (< 1 MW = < 1000 kWp)

-- Also fix monitor_plants
UPDATE monitor_plants
SET installed_power_kwp = installed_power_kwp * 1000,
    updated_at = now()
WHERE provider_id = 'huawei_fusionsolar'
  AND installed_power_kwp > 0
  AND installed_power_kwp < 1;