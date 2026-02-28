
-- P0 columns for field parity with SolarMarket
-- All nullable to avoid breaking existing inserts

ALTER TABLE public.proposta_versoes
  ADD COLUMN IF NOT EXISTS tir NUMERIC,
  ADD COLUMN IF NOT EXISTS vpl NUMERIC,
  ADD COLUMN IF NOT EXISTS geracao_anual NUMERIC,
  ADD COLUMN IF NOT EXISTS economia_mensal_percent NUMERIC,
  ADD COLUMN IF NOT EXISTS consumo_mensal NUMERIC,
  ADD COLUMN IF NOT EXISTS tarifa_distribuidora NUMERIC,
  ADD COLUMN IF NOT EXISTS distribuidora_nome TEXT,
  ADD COLUMN IF NOT EXISTS inflacao_energetica NUMERIC,
  ADD COLUMN IF NOT EXISTS perda_eficiencia_anual NUMERIC,
  ADD COLUMN IF NOT EXISTS sobredimensionamento NUMERIC,
  ADD COLUMN IF NOT EXISTS custo_disponibilidade NUMERIC,
  ADD COLUMN IF NOT EXISTS link_pdf TEXT,
  ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS enviado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'native';

-- Indexes for filtering on tenant + key KPIs
CREATE INDEX IF NOT EXISTS idx_pv_tenant_tir ON public.proposta_versoes(tenant_id, tir) WHERE tir IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pv_tenant_vpl ON public.proposta_versoes(tenant_id, vpl) WHERE vpl IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pv_tenant_consumo ON public.proposta_versoes(tenant_id, consumo_mensal) WHERE consumo_mensal IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pv_tenant_geracao_anual ON public.proposta_versoes(tenant_id, geracao_anual) WHERE geracao_anual IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pv_tenant_origem ON public.proposta_versoes(tenant_id, origem);
CREATE INDEX IF NOT EXISTS idx_pv_tenant_distribuidora ON public.proposta_versoes(tenant_id, distribuidora_nome) WHERE distribuidora_nome IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pv_link_pdf ON public.proposta_versoes(tenant_id) WHERE link_pdf IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN public.proposta_versoes.origem IS 'native | legacy_import | solarmarket';
COMMENT ON COLUMN public.proposta_versoes.tir IS 'Taxa Interna de Retorno (%) - P0 KPI';
COMMENT ON COLUMN public.proposta_versoes.vpl IS 'Valor Presente Líquido (R$) - P0 KPI';
