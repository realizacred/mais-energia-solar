-- ============================================================
-- FASE 1: CONTENÇÃO — Solar Data Layer Hardening
-- Sem breaking changes. Adiciona proteções e campos novos.
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- 1A) IMUTABILIDADE: Trigger que PROÍBE UPDATE em dados RAW
-- ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.guard_irradiance_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'irradiance_points_monthly is IMMUTABLE: UPDATE forbidden. Create a new version instead.'
    USING ERRCODE = 'P0403';
END;
$$;

CREATE TRIGGER trg_irradiance_points_immutable
  BEFORE UPDATE ON public.irradiance_points_monthly
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_irradiance_immutability();

-- ──────────────────────────────────────────────────────────
-- 1B) IMUTABILIDADE: Trigger que PROÍBE UPDATE em versões
--     (exceto transição de status: processing→active→archived)
-- ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.guard_irradiance_version_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Allow status transitions only
  IF OLD.status = 'processing' AND NEW.status IN ('active', 'failed') THEN
    -- Allow updating status, row_count, metadata, updated_at during finalization
    IF NEW.dataset_id IS DISTINCT FROM OLD.dataset_id
       OR NEW.version_tag IS DISTINCT FROM OLD.version_tag
       OR NEW.checksum_sha256 IS DISTINCT FROM OLD.checksum_sha256 THEN
      RAISE EXCEPTION 'irradiance_dataset_versions: cannot change identity fields after creation'
        USING ERRCODE = 'P0403';
    END IF;
    RETURN NEW;
  END IF;

  -- Allow archiving an active version
  IF OLD.status = 'active' AND NEW.status = 'archived' THEN
    RETURN NEW;
  END IF;

  -- Block everything else
  RAISE EXCEPTION 'irradiance_dataset_versions: published versions are immutable (status=%). Only status transitions allowed.', OLD.status
    USING ERRCODE = 'P0403';
END;
$$;

CREATE TRIGGER trg_irradiance_version_immutable
  BEFORE UPDATE ON public.irradiance_dataset_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_irradiance_version_immutability();

-- ──────────────────────────────────────────────────────────
-- 1C) RASTREABILIDADE: Campos em simulacoes
-- ──────────────────────────────────────────────────────────

ALTER TABLE public.simulacoes
  ADD COLUMN IF NOT EXISTS irradiance_version_id UUID REFERENCES irradiance_dataset_versions(id),
  ADD COLUMN IF NOT EXISTS irradiance_dataset_code TEXT,
  ADD COLUMN IF NOT EXISTS irradiance_source_lat NUMERIC,
  ADD COLUMN IF NOT EXISTS irradiance_source_lon NUMERIC,
  ADD COLUMN IF NOT EXISTS irradiance_distance_km NUMERIC,
  ADD COLUMN IF NOT EXISTS irradiance_point_id BIGINT,
  ADD COLUMN IF NOT EXISTS irradiance_method TEXT DEFAULT 'nearest',
  ADD COLUMN IF NOT EXISTS irradiance_units TEXT DEFAULT 'kwh_m2_day';

COMMENT ON COLUMN public.simulacoes.irradiance_version_id IS 'FK para a versão exata do dataset meteorológico usada nesta simulação';
COMMENT ON COLUMN public.simulacoes.irradiance_dataset_code IS 'Código do dataset (ex: INPE_2017_SUNDATA) — desnormalizado para auditoria';
COMMENT ON COLUMN public.simulacoes.irradiance_source_lat IS 'Latitude do ponto da grade meteorológica usado';
COMMENT ON COLUMN public.simulacoes.irradiance_source_lon IS 'Longitude do ponto da grade meteorológica usado';
COMMENT ON COLUMN public.simulacoes.irradiance_distance_km IS 'Distância em km entre coordenada real e ponto da grade';
COMMENT ON COLUMN public.simulacoes.irradiance_method IS 'Método de interpolação: nearest, bilinear, idw';

-- ──────────────────────────────────────────────────────────
-- 1D) RASTREABILIDADE: Campos em proposta_versoes
-- ──────────────────────────────────────────────────────────

ALTER TABLE public.proposta_versoes
  ADD COLUMN IF NOT EXISTS irradiance_version_id UUID REFERENCES irradiance_dataset_versions(id),
  ADD COLUMN IF NOT EXISTS irradiance_dataset_code TEXT,
  ADD COLUMN IF NOT EXISTS irradiance_source_point JSONB;

COMMENT ON COLUMN public.proposta_versoes.irradiance_version_id IS 'FK para a versão do dataset meteorológico usada no cálculo';
COMMENT ON COLUMN public.proposta_versoes.irradiance_dataset_code IS 'Código do dataset — desnormalizado para auditoria rápida';
COMMENT ON COLUMN public.proposta_versoes.irradiance_source_point IS 'JSON: {lat, lon, distance_km, method, point_id}';

-- ──────────────────────────────────────────────────────────
-- 1E) METADATA: Campo plane nos pontos (horizontal por design)
-- ──────────────────────────────────────────────────────────

ALTER TABLE public.irradiance_points_monthly
  ADD COLUMN IF NOT EXISTS plane TEXT NOT NULL DEFAULT 'horizontal';

-- Index para queries filtradas por plane (futuro-proof)
CREATE INDEX IF NOT EXISTS idx_irradiance_points_plane
  ON public.irradiance_points_monthly (version_id, plane);

-- ──────────────────────────────────────────────────────────
-- 1F) METADATA VALIDATION: Impedir metadata vazio em versões
-- ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.validate_irradiance_version_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- On finalization (processing → active), require minimal metadata
  IF NEW.status = 'active' THEN
    IF NEW.metadata IS NULL OR NEW.metadata = '{}'::jsonb THEN
      RAISE EXCEPTION 'irradiance_dataset_versions: metadata cannot be empty when activating a version'
        USING ERRCODE = 'P0422';
    END IF;

    -- Require row_count > 0
    IF NEW.row_count <= 0 THEN
      RAISE EXCEPTION 'irradiance_dataset_versions: row_count must be > 0 when activating'
        USING ERRCODE = 'P0422';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_irradiance_version_metadata
  BEFORE INSERT OR UPDATE ON public.irradiance_dataset_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_irradiance_version_metadata();