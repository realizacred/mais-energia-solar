
-- ═══════════════════════════════════════════════════════════
-- SSOT: Irradiation Daily Cache
-- Stores daily HSP (kWh/m²) per geo location for PR calculation
-- ═══════════════════════════════════════════════════════════

CREATE TABLE public.irradiation_daily_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  latitude NUMERIC(9,6) NOT NULL,
  longitude NUMERIC(9,6) NOT NULL,
  source TEXT NOT NULL DEFAULT 'premise',
  hsp_kwh_m2 NUMERIC(5,2) NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'low',
  raw_payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: one entry per date + location + source
CREATE UNIQUE INDEX idx_irradiation_daily_unique ON public.irradiation_daily_cache (date, latitude, longitude, source);

-- Index for fast lookups by date range
CREATE INDEX idx_irradiation_daily_date ON public.irradiation_daily_cache (date);

-- Enable RLS
ALTER TABLE public.irradiation_daily_cache ENABLE ROW LEVEL SECURITY;

-- Public read (irradiation data is not tenant-specific)
CREATE POLICY "Irradiation data is publicly readable"
  ON public.irradiation_daily_cache FOR SELECT
  USING (true);

-- Only service_role can insert/update (edge functions)
CREATE POLICY "Service role can manage irradiation data"
  ON public.irradiation_daily_cache FOR ALL
  USING (auth.role() = 'service_role');

-- ═══════════════════════════════════════════════════════════
-- Regional HSP Premises (seasonal fallback)
-- Brazilian average HSP by month (source: CRESESB/Atlas Solarimétrico)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE public.irradiation_regional_premises (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  region TEXT NOT NULL,
  month INT NOT NULL CHECK (month >= 1 AND month <= 12),
  hsp_kwh_m2 NUMERIC(5,2) NOT NULL,
  source TEXT NOT NULL DEFAULT 'atlas_solarimetrico',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_irradiation_regional_unique ON public.irradiation_regional_premises (region, month);

ALTER TABLE public.irradiation_regional_premises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Regional premises are publicly readable"
  ON public.irradiation_regional_premises FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage regional premises"
  ON public.irradiation_regional_premises FOR ALL
  USING (auth.role() = 'service_role');

-- Seed Brazilian regional averages (kWh/m²/day)
INSERT INTO public.irradiation_regional_premises (region, month, hsp_kwh_m2) VALUES
  -- Nordeste (maior irradiação do Brasil)
  ('nordeste', 1, 6.0), ('nordeste', 2, 5.8), ('nordeste', 3, 5.5),
  ('nordeste', 4, 5.2), ('nordeste', 5, 4.8), ('nordeste', 6, 4.5),
  ('nordeste', 7, 4.7), ('nordeste', 8, 5.3), ('nordeste', 9, 5.8),
  ('nordeste', 10, 6.1), ('nordeste', 11, 6.2), ('nordeste', 12, 6.1),
  -- Sudeste
  ('sudeste', 1, 5.2), ('sudeste', 2, 5.3), ('sudeste', 3, 5.0),
  ('sudeste', 4, 4.5), ('sudeste', 5, 4.0), ('sudeste', 6, 3.7),
  ('sudeste', 7, 3.9), ('sudeste', 8, 4.3), ('sudeste', 9, 4.6),
  ('sudeste', 10, 5.0), ('sudeste', 11, 5.2), ('sudeste', 12, 5.1),
  -- Sul
  ('sul', 1, 5.5), ('sul', 2, 5.2), ('sul', 3, 4.6),
  ('sul', 4, 3.8), ('sul', 5, 3.2), ('sul', 6, 2.8),
  ('sul', 7, 3.0), ('sul', 8, 3.5), ('sul', 9, 3.8),
  ('sul', 10, 4.5), ('sul', 11, 5.2), ('sul', 12, 5.5),
  -- Centro-Oeste
  ('centro_oeste', 1, 5.0), ('centro_oeste', 2, 5.0), ('centro_oeste', 3, 5.0),
  ('centro_oeste', 4, 5.0), ('centro_oeste', 5, 4.8), ('centro_oeste', 6, 4.5),
  ('centro_oeste', 7, 4.8), ('centro_oeste', 8, 5.2), ('centro_oeste', 9, 5.3),
  ('centro_oeste', 10, 5.2), ('centro_oeste', 11, 5.0), ('centro_oeste', 12, 4.9),
  -- Norte
  ('norte', 1, 4.2), ('norte', 2, 4.0), ('norte', 3, 3.8),
  ('norte', 4, 3.8), ('norte', 5, 4.2), ('norte', 6, 4.5),
  ('norte', 7, 4.8), ('norte', 8, 5.0), ('norte', 9, 5.0),
  ('norte', 10, 4.8), ('norte', 11, 4.5), ('norte', 12, 4.2),
  -- Média Brasil (fallback genérico)
  ('brasil', 1, 5.0), ('brasil', 2, 5.0), ('brasil', 3, 4.8),
  ('brasil', 4, 4.5), ('brasil', 5, 4.2), ('brasil', 6, 3.9),
  ('brasil', 7, 4.1), ('brasil', 8, 4.5), ('brasil', 9, 4.7),
  ('brasil', 10, 5.0), ('brasil', 11, 5.2), ('brasil', 12, 5.1);
