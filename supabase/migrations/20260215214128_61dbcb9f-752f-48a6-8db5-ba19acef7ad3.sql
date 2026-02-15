
-- Seed dos datasets canônicos de irradiância (idempotente)
INSERT INTO public.irradiance_datasets (code, name, provider, resolution_km, default_unit, description, coverage)
VALUES
  (
    'INPE_2009_10KM',
    'Brazil Solar Global 10km (INPE 2009)',
    'INPE',
    10,
    'kwh_m2_day',
    'Atlas Brasileiro de Energia Solar - Grade global 10km sobre o território brasileiro. Dados médios mensais de irradiação solar global horizontal.',
    '{"country": "BR", "bbox": [-33.75, -73.99, 5.27, -34.79]}'::jsonb
  ),
  (
    'INPE_2017_SUNDATA',
    'Atlas Brasileiro 2ª Edição (INPE 2017 / SUNDATA / CRESESB)',
    'INPE/CRESESB',
    NULL,
    'kwh_m2_day',
    'Atlas Brasileiro de Energia Solar 2ª Edição - Base SUNDATA do CRESESB/CEPEL. Dados por município/localidade com séries mensais de irradiação.',
    '{"country": "BR", "source": "SUNDATA/CRESESB/CEPEL"}'::jsonb
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  provider = EXCLUDED.provider,
  resolution_km = EXCLUDED.resolution_km,
  description = EXCLUDED.description,
  coverage = EXCLUDED.coverage,
  updated_at = now();
