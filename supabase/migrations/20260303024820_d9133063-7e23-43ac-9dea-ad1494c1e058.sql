
-- Auto-provision monitor_plants for all solar_plants that don't have one yet
INSERT INTO monitor_plants (tenant_id, provider_id, provider_plant_id, name, installed_power_kwp, legacy_plant_id, is_active, updated_at)
SELECT 
  sp.tenant_id,
  sp.provider,
  sp.external_id,
  sp.name,
  sp.capacity_kw,
  sp.id,
  true,
  now()
FROM solar_plants sp
LEFT JOIN monitor_plants mp ON mp.legacy_plant_id = sp.id
WHERE mp.id IS NULL
ON CONFLICT (tenant_id, provider_id, provider_plant_id) 
DO UPDATE SET 
  legacy_plant_id = EXCLUDED.legacy_plant_id,
  name = EXCLUDED.name,
  installed_power_kwp = EXCLUDED.installed_power_kwp,
  updated_at = now();
