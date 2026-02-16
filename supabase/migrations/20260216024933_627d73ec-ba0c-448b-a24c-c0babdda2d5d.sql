-- ============================================================
-- FASE 3: HARDENING FINAL — RLS Restritivo + Constraints
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- 3A) REVOGAR INSERT direto em irradiance_points_monthly para anon
--     (authenticated já pode inserir via importador, mas restringir a admins)
-- ──────────────────────────────────────────────────────────

-- Remove any existing INSERT policy if present
DROP POLICY IF EXISTS "Authenticated can insert irradiance_points_monthly" ON public.irradiance_points_monthly;
DROP POLICY IF EXISTS "Anyone can insert irradiance_points_monthly" ON public.irradiance_points_monthly;

-- Only admins can INSERT (importação via UI ou edge function com service_role)
CREATE POLICY "Admins can insert irradiance_points_monthly"
  ON public.irradiance_points_monthly
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- ──────────────────────────────────────────────────────────
-- 3B) Restringir INSERT em irradiance_dataset_versions a admins
-- ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated can insert irradiance_dataset_versions" ON public.irradiance_dataset_versions;
DROP POLICY IF EXISTS "Anyone can insert irradiance_dataset_versions" ON public.irradiance_dataset_versions;

CREATE POLICY "Admins can insert irradiance_dataset_versions"
  ON public.irradiance_dataset_versions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Admins can update versions (controlled by trigger for immutability)
DROP POLICY IF EXISTS "Authenticated can update irradiance_dataset_versions" ON public.irradiance_dataset_versions;

CREATE POLICY "Admins can update irradiance_dataset_versions"
  ON public.irradiance_dataset_versions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- ──────────────────────────────────────────────────────────
-- 3C) RPC para resolver a versão ativa canônica de um dataset
--     Usado pelo motor de cálculo para sempre pegar a versão certa
-- ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_canonical_irradiance_version(_dataset_code text DEFAULT 'INPE_2017_SUNDATA')
RETURNS TABLE(
  version_id uuid,
  dataset_id uuid,
  dataset_code text,
  dataset_name text,
  version_tag text,
  has_dhi boolean,
  has_dni boolean,
  row_count bigint,
  checksum text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    v.id AS version_id,
    d.id AS dataset_id,
    d.code AS dataset_code,
    d.name AS dataset_name,
    v.version_tag,
    COALESCE((v.metadata->>'has_dhi')::boolean, false) AS has_dhi,
    COALESCE((v.metadata->>'has_dni')::boolean, false) AS has_dni,
    v.row_count,
    v.checksum_sha256 AS checksum
  FROM irradiance_dataset_versions v
  JOIN irradiance_datasets d ON d.id = v.dataset_id
  WHERE d.code = _dataset_code
    AND v.status = 'active'
  ORDER BY v.ingested_at DESC
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_canonical_irradiance_version IS 
'Returns the canonical (active) version for a given dataset code. Single source of truth for which version to use in calculations.';

-- ============================================================
-- FASE 4: POA LAYER — Tabela de Transposição Separada
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- 4A) Tabela para dados transpostos (POA) — NUNCA sobrescreve RAW
-- ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.irradiance_transposed_monthly (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  version_id UUID NOT NULL REFERENCES irradiance_dataset_versions(id) ON DELETE CASCADE,
  source_point_id BIGINT NOT NULL,
  lat NUMERIC NOT NULL,
  lon NUMERIC NOT NULL,
  tilt_deg NUMERIC NOT NULL,
  azimuth_deg NUMERIC NOT NULL,
  transposition_model TEXT NOT NULL DEFAULT 'liu_jordan',
  -- POA monthly values (kWh/m²/day)
  poa_m01 NUMERIC NOT NULL DEFAULT 0,
  poa_m02 NUMERIC NOT NULL DEFAULT 0,
  poa_m03 NUMERIC NOT NULL DEFAULT 0,
  poa_m04 NUMERIC NOT NULL DEFAULT 0,
  poa_m05 NUMERIC NOT NULL DEFAULT 0,
  poa_m06 NUMERIC NOT NULL DEFAULT 0,
  poa_m07 NUMERIC NOT NULL DEFAULT 0,
  poa_m08 NUMERIC NOT NULL DEFAULT 0,
  poa_m09 NUMERIC NOT NULL DEFAULT 0,
  poa_m10 NUMERIC NOT NULL DEFAULT 0,
  poa_m11 NUMERIC NOT NULL DEFAULT 0,
  poa_m12 NUMERIC NOT NULL DEFAULT 0,
  -- Metadata
  unit TEXT NOT NULL DEFAULT 'kwh_m2_day',
  dhi_source TEXT NOT NULL DEFAULT 'measured', -- 'measured' | 'estimated_erbs'
  losses_assumptions JSONB DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  computed_by UUID, -- user who triggered the computation

  -- Uniqueness: one transposition per point/tilt/azimuth/model combination
  CONSTRAINT uq_transposed_point_config UNIQUE (version_id, source_point_id, tilt_deg, azimuth_deg, transposition_model)
);

-- Enable RLS
ALTER TABLE public.irradiance_transposed_monthly ENABLE ROW LEVEL SECURITY;

-- Everyone can read (global resource)
CREATE POLICY "Authenticated can read irradiance_transposed"
  ON public.irradiance_transposed_monthly
  FOR SELECT USING (true);

-- Only admins/system can write
CREATE POLICY "Admins can insert irradiance_transposed"
  ON public.irradiance_transposed_monthly
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Transposed data is also immutable (recalculate = new row with different params)
CREATE TRIGGER trg_irradiance_transposed_immutable
  BEFORE UPDATE ON public.irradiance_transposed_monthly
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_irradiance_immutability();

-- Admins can delete (for cleanup)
CREATE POLICY "Admins can delete irradiance_transposed"
  ON public.irradiance_transposed_monthly
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_transposed_version_point
  ON public.irradiance_transposed_monthly (version_id, source_point_id);

CREATE INDEX IF NOT EXISTS idx_transposed_lookup
  ON public.irradiance_transposed_monthly (version_id, lat, lon, tilt_deg, azimuth_deg);

COMMENT ON TABLE public.irradiance_transposed_monthly IS 
'POA (Plane of Array) irradiance computed from RAW horizontal data. 
NEVER overwrites raw data. Each row represents a specific tilt/azimuth/model combination.
dhi_source indicates whether DHI was measured or estimated (Erbs correlation).';