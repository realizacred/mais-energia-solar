CREATE OR REPLACE VIEW monitor_plants_with_metrics AS
SELECT
  mp.id,
  mp.tenant_id,
  mp.client_id,
  mp.name,
  mp.lat,
  mp.lng,
  mp.city,
  mp.state,
  mp.installed_power_kwp,
  mp.provider_id,
  mp.provider_plant_id,
  mp.is_active,
  mp.last_seen_at,
  mp.legacy_plant_id,
  mp.created_at,
  mp.updated_at,
  today.energy_kwh    AS today_energy_kwh,
  today.peak_power_kw AS today_peak_power_kw,
  COALESCE(month.total_kwh, 0) AS month_energy_kwh
FROM monitor_plants mp
LEFT JOIN monitor_readings_daily today
  ON today.plant_id = mp.id
  AND today.date = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date
LEFT JOIN (
  SELECT plant_id, sum(energy_kwh) AS total_kwh
  FROM monitor_readings_daily
  WHERE date >= date_trunc('month', (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo'))::date
  GROUP BY plant_id
) month ON month.plant_id = mp.id