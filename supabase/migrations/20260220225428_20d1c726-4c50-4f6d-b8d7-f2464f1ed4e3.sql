
-- ──────────────────────────────────────────────────────────────
-- ANEEL Integration: Sync Runs + Tariff Versions
-- Extends concessionarias without overwriting existing data
-- ──────────────────────────────────────────────────────────────

-- 1. aneel_sync_runs — auditoria imutável de cada execução de sync
CREATE TABLE IF NOT EXISTS public.aneel_sync_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  triggered_by    UUID REFERENCES auth.users(id),
  trigger_type    TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'scheduled'
  status          TEXT NOT NULL DEFAULT 'running', -- 'running' | 'success' | 'partial' | 'error'
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at     TIMESTAMPTZ,
  total_fetched   INTEGER DEFAULT 0,
  total_matched   INTEGER DEFAULT 0,
  total_updated   INTEGER DEFAULT 0,
  total_errors    INTEGER DEFAULT 0,
  snapshot_hash   TEXT,  -- SHA-256 of raw ANEEL response
  logs            JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.aneel_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_own_sync_runs" ON public.aneel_sync_runs
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() LIMIT 1));

-- 2. tariff_versions — versionamento por vigência (nunca sobrescreve)
CREATE TABLE IF NOT EXISTS public.tariff_versions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  concessionaria_id UUID NOT NULL REFERENCES public.concessionarias(id) ON DELETE CASCADE,
  run_id            UUID REFERENCES public.aneel_sync_runs(id),
  -- Vigência
  vigencia_inicio   DATE NOT NULL,
  vigencia_fim      DATE,
  is_active         BOOLEAN NOT NULL DEFAULT false,
  -- Origem do dado
  origem            TEXT NOT NULL DEFAULT 'ANEEL', -- 'ANEEL' | 'manual' | 'premissa'
  -- Componentes tarifários Grupo B
  te_kwh            NUMERIC(10,6),  -- Tarifa de Energia R$/kWh
  tusd_fio_b_kwh    NUMERIC(10,6),  -- Fio B R$/kWh (TUSD parcial)
  tusd_fio_a_kwh    NUMERIC(10,6),  -- Fio A (para GD III)
  tfsee_kwh         NUMERIC(10,6),  -- TFSEE (para GD III)
  pnd_kwh           NUMERIC(10,6),  -- P&D (para GD III)
  tusd_total_kwh    NUMERIC(10,6),  -- TUSD total (Fio A + Fio B + outros)
  tarifa_total_kwh  NUMERIC(10,6),  -- TE + TUSD (referência rápida)
  -- Custo de disponibilidade (kWh/mês)
  custo_disp_mono   NUMERIC(10,2),
  custo_disp_bi     NUMERIC(10,2),
  custo_disp_tri    NUMERIC(10,2),
  -- Tributação
  aliquota_icms     NUMERIC(5,2),
  possui_isencao    BOOLEAN DEFAULT false,
  percentual_isencao NUMERIC(5,2),
  -- Auditoria
  snapshot_raw      JSONB,  -- Raw ANEEL record para rastreabilidade completa
  snapshot_hash     TEXT,   -- Hash do registro ANEEL
  -- Validação
  validation_status TEXT NOT NULL DEFAULT 'ok', -- 'ok' | 'atencao' | 'incompleto_gd3'
  validation_notes  JSONB DEFAULT '[]'::jsonb,
  published_at      TIMESTAMPTZ,
  published_by      UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tariff_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_own_tariff_versions" ON public.tariff_versions
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() LIMIT 1));

-- Unicidade: apenas uma versão ativa por concessionária+tenant
CREATE UNIQUE INDEX idx_tariff_versions_active_unique
  ON public.tariff_versions(tenant_id, concessionaria_id)
  WHERE is_active = true;

-- Índices de performance
CREATE INDEX idx_tariff_versions_concessionaria ON public.tariff_versions(concessionaria_id, tenant_id);
CREATE INDEX idx_tariff_versions_vigencia ON public.tariff_versions(vigencia_inicio DESC);
CREATE INDEX idx_aneel_sync_runs_tenant ON public.aneel_sync_runs(tenant_id, started_at DESC);

-- Trigger: atualiza updated_at em tariff_versions
CREATE OR REPLACE FUNCTION public.update_tariff_versions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER tariff_versions_updated_at
  BEFORE UPDATE ON public.tariff_versions
  FOR EACH ROW EXECUTE FUNCTION public.update_tariff_versions_updated_at();

-- Função auxiliar: retorna tariff_version ativa para uma concessionária
CREATE OR REPLACE FUNCTION public.get_active_tariff_version(
  p_concessionaria_id UUID,
  p_tenant_id UUID
)
RETURNS TABLE (
  id UUID,
  te_kwh NUMERIC,
  tusd_fio_b_kwh NUMERIC,
  tusd_fio_a_kwh NUMERIC,
  tfsee_kwh NUMERIC,
  pnd_kwh NUMERIC,
  tarifa_total_kwh NUMERIC,
  custo_disp_mono NUMERIC,
  custo_disp_bi NUMERIC,
  custo_disp_tri NUMERIC,
  vigencia_inicio DATE,
  vigencia_fim DATE,
  origem TEXT,
  validation_status TEXT
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT
    id, te_kwh, tusd_fio_b_kwh, tusd_fio_a_kwh, tfsee_kwh, pnd_kwh,
    tarifa_total_kwh, custo_disp_mono, custo_disp_bi, custo_disp_tri,
    vigencia_inicio, vigencia_fim, origem, validation_status
  FROM tariff_versions
  WHERE concessionaria_id = p_concessionaria_id
    AND tenant_id = p_tenant_id
    AND is_active = true
  LIMIT 1;
$$;
