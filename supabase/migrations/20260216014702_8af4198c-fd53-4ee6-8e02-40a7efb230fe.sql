INSERT INTO irradiance_datasets (code, name, description, provider, resolution_km, coverage, default_unit)
VALUES (
  'NASA_POWER_GLOBAL',
  'NASA POWER — Global Solar Resource (CERES/SSE)',
  'Dados globais de irradiância solar da NASA POWER API (CERES/SSE). Resolução 0.5° (~50km). Cobertura mundial com séries mensais GHI, DHI, DNI.',
  'NASA',
  50,
  '{"region": "global", "lat_range": [-90, 90], "lon_range": [-180, 180]}'::jsonb,
  'kwh_m2_day'
)
ON CONFLICT DO NOTHING;