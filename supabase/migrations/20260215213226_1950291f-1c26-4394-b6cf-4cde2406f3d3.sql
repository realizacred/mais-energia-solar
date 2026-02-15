
-- ====================================================================
-- IRRADIANCE ENGINE — Global Reference + Tenant Config + Audit
-- ====================================================================

-- 1) Global: irradiance_datasets (catálogo de fontes de dados)
CREATE TABLE public.irradiance_datasets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  provider text NOT NULL,
  resolution_km numeric NULL,
  coverage jsonb NOT NULL DEFAULT '{}',
  default_unit text NOT NULL DEFAULT 'kwh_m2_day',
  description text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.irradiance_datasets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read irradiance_datasets"
  ON public.irradiance_datasets FOR SELECT TO authenticated
  USING (true);

-- 2) Global: irradiance_dataset_versions (versionamento + integridade)
CREATE TABLE public.irradiance_dataset_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id uuid NOT NULL REFERENCES public.irradiance_datasets(id) ON DELETE CASCADE,
  version_tag text NOT NULL,
  source_note text NULL,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  checksum_sha256 text NULL,
  row_count bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('active', 'deprecated', 'processing', 'failed')),
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dataset_id, version_tag)
);

ALTER TABLE public.irradiance_dataset_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read irradiance_dataset_versions"
  ON public.irradiance_dataset_versions FOR SELECT TO authenticated
  USING (true);

-- 3) Global: irradiance_points_monthly (malha de pontos — dados de irradiação)
CREATE TABLE public.irradiance_points_monthly (
  id bigserial PRIMARY KEY,
  version_id uuid NOT NULL REFERENCES public.irradiance_dataset_versions(id) ON DELETE CASCADE,
  lat numeric(9,6) NOT NULL,
  lon numeric(9,6) NOT NULL,
  m01 numeric(10,4) NOT NULL DEFAULT 0,
  m02 numeric(10,4) NOT NULL DEFAULT 0,
  m03 numeric(10,4) NOT NULL DEFAULT 0,
  m04 numeric(10,4) NOT NULL DEFAULT 0,
  m05 numeric(10,4) NOT NULL DEFAULT 0,
  m06 numeric(10,4) NOT NULL DEFAULT 0,
  m07 numeric(10,4) NOT NULL DEFAULT 0,
  m08 numeric(10,4) NOT NULL DEFAULT 0,
  m09 numeric(10,4) NOT NULL DEFAULT 0,
  m10 numeric(10,4) NOT NULL DEFAULT 0,
  m11 numeric(10,4) NOT NULL DEFAULT 0,
  m12 numeric(10,4) NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'kwh_m2_day'
);

CREATE INDEX idx_irradiance_points_version_lat_lon
  ON public.irradiance_points_monthly (version_id, lat, lon);

ALTER TABLE public.irradiance_points_monthly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read irradiance_points_monthly"
  ON public.irradiance_points_monthly FOR SELECT TO authenticated
  USING (true);

-- 4) Global: irradiance_lookup_cache (cache de consultas arredondadas)
CREATE TABLE public.irradiance_lookup_cache (
  id bigserial PRIMARY KEY,
  version_id uuid NOT NULL REFERENCES public.irradiance_dataset_versions(id) ON DELETE CASCADE,
  lat_round numeric(9,4) NOT NULL,
  lon_round numeric(9,4) NOT NULL,
  method text NOT NULL DEFAULT 'nearest',
  series jsonb NOT NULL,
  point_lat numeric(9,6),
  point_lon numeric(9,6),
  distance_km numeric(10,3),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (version_id, lat_round, lon_round, method)
);

ALTER TABLE public.irradiance_lookup_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read irradiance_lookup_cache"
  ON public.irradiance_lookup_cache FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert irradiance_lookup_cache"
  ON public.irradiance_lookup_cache FOR INSERT TO authenticated
  WITH CHECK (true);

-- 5) Tenant-scoped: tenant_irradiance_config
CREATE TABLE public.tenant_irradiance_config (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  dataset_code text NOT NULL DEFAULT 'INPE_2017_SUNDATA',
  version_id uuid NULL REFERENCES public.irradiance_dataset_versions(id),
  lookup_method text NOT NULL DEFAULT 'nearest'
    CHECK (lookup_method IN ('nearest', 'bilinear')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL
);

ALTER TABLE public.tenant_irradiance_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant can read own irradiance config"
  ON public.tenant_irradiance_config FOR SELECT TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant can upsert own irradiance config"
  ON public.tenant_irradiance_config FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant can update own irradiance config"
  ON public.tenant_irradiance_config FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- 6) Nearest-point lookup function (SECURITY DEFINER for perf — bypasses RLS)
CREATE OR REPLACE FUNCTION public.irradiance_nearest_point(
  p_version_id uuid,
  p_lat numeric,
  p_lon numeric,
  p_radius_deg numeric DEFAULT 0.5
)
RETURNS TABLE (
  point_id bigint,
  lat numeric,
  lon numeric,
  m01 numeric, m02 numeric, m03 numeric, m04 numeric,
  m05 numeric, m06 numeric, m07 numeric, m08 numeric,
  m09 numeric, m10 numeric, m11 numeric, m12 numeric,
  unit text,
  distance_km numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id AS point_id,
    p.lat, p.lon,
    p.m01, p.m02, p.m03, p.m04,
    p.m05, p.m06, p.m07, p.m08,
    p.m09, p.m10, p.m11, p.m12,
    p.unit,
    (6371 * acos(
      LEAST(1, cos(radians(p_lat)) * cos(radians(p.lat)) *
      cos(radians(p.lon) - radians(p_lon)) +
      sin(radians(p_lat)) * sin(radians(p.lat)))
    ))::numeric(10,3) AS distance_km
  FROM public.irradiance_points_monthly p
  WHERE p.version_id = p_version_id
    AND p.lat BETWEEN (p_lat - p_radius_deg) AND (p_lat + p_radius_deg)
    AND p.lon BETWEEN (p_lon - p_radius_deg) AND (p_lon + p_radius_deg)
  ORDER BY distance_km ASC
  LIMIT 1;
$$;

-- 7) Seed canonical datasets
INSERT INTO public.irradiance_datasets (code, name, provider, resolution_km, default_unit, coverage, description) VALUES
  ('INPE_2009_10KM', 'Brazil Solar Global 10km (INPE 2009)', 'INPE', 10, 'kwh_m2_day',
   '{"country": "BR", "bbox": {"south": -33.75, "west": -73.99, "north": 5.27, "east": -34.79}}',
   'Atlas Brasileiro de Energia Solar 1ª Edição. Dados 1995-2005. Resolução 10km.'),
  ('INPE_2017_SUNDATA', 'Atlas Brasileiro 2ª Edição (INPE 2017 / SUNDATA / CRESESB)', 'INPE/CRESESB', 10, 'kwh_m2_day',
   '{"country": "BR", "bbox": {"south": -33.75, "west": -73.99, "north": 5.27, "east": -34.79}}',
   'Atlas Brasileiro de Energia Solar 2ª Edição (2017). Base SUNDATA/CRESESB.');

-- 8) Storage buckets (private)
INSERT INTO storage.buckets (id, name, public) VALUES
  ('irradiance-source', 'irradiance-source', false),
  ('irradiance-artifacts', 'irradiance-artifacts', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Auth read irradiance-source"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'irradiance-source');

CREATE POLICY "Auth read irradiance-artifacts"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'irradiance-artifacts');
