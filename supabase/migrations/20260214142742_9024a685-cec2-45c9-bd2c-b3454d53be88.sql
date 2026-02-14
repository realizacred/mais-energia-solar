
-- ═══════════════════════════════════════════════════════
-- CONTENÇÃO: Unificar propostas + deprecar proposta_itens
-- ═══════════════════════════════════════════════════════

-- 1) Renomear tabela legada para marcar como deprecated
ALTER TABLE public.propostas RENAME TO propostas_sm_legado;

-- 2) Dropar proposta_itens (0 rows, sem versionamento, substituída por snapshot)
DROP TABLE IF EXISTS public.proposta_itens;

-- 3) Adicionar campos de origem e sync SM em propostas_nativas
ALTER TABLE public.propostas_nativas
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'native'
    CONSTRAINT chk_origem CHECK (origem IN ('native', 'imported')),
  ADD COLUMN IF NOT EXISTS sm_id text,
  ADD COLUMN IF NOT EXISTS sm_project_id text,
  ADD COLUMN IF NOT EXISTS sm_raw_payload jsonb,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'rascunho'
    CONSTRAINT chk_status CHECK (status IN ('rascunho', 'gerada', 'enviada', 'aceita', 'recusada', 'expirada', 'cancelada')),
  ADD COLUMN IF NOT EXISTS validade_dias integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS enviada_at timestamptz,
  ADD COLUMN IF NOT EXISTS aceita_at timestamptz,
  ADD COLUMN IF NOT EXISTS recusada_at timestamptz,
  ADD COLUMN IF NOT EXISTS recusa_motivo text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_propostas_nativas_sm_id
  ON public.propostas_nativas (tenant_id, sm_id) WHERE sm_id IS NOT NULL;

-- 4) Criar tabela premissas_default_tenant
CREATE TABLE IF NOT EXISTS public.premissas_default_tenant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  inflacao_energetica numeric NOT NULL DEFAULT 6.0,
  inflacao_ipca numeric NOT NULL DEFAULT 4.5,
  taxa_desconto_vpl numeric NOT NULL DEFAULT 8.0,
  perda_eficiencia_anual numeric NOT NULL DEFAULT 0.5,
  sobredimensionamento numeric NOT NULL DEFAULT 0.0,
  troca_inversor_ano integer NOT NULL DEFAULT 12,
  troca_inversor_custo_percentual numeric NOT NULL DEFAULT 30.0,
  custo_disponibilidade_monofasico numeric NOT NULL DEFAULT 30.0,
  custo_disponibilidade_bifasico numeric NOT NULL DEFAULT 50.0,
  custo_disponibilidade_trifasico numeric NOT NULL DEFAULT 100.0,
  fator_simultaneidade numeric NOT NULL DEFAULT 1.0,
  vida_util_sistema integer NOT NULL DEFAULT 25,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_premissas_tenant UNIQUE (tenant_id)
);

ALTER TABLE public.premissas_default_tenant ENABLE ROW LEVEL SECURITY;

CREATE POLICY "premissas_default_tenant_select"
  ON public.premissas_default_tenant FOR SELECT
  USING (tenant_id = (SELECT get_user_tenant_id()));

CREATE POLICY "premissas_default_tenant_insert"
  ON public.premissas_default_tenant FOR INSERT
  WITH CHECK (tenant_id = (SELECT get_user_tenant_id()));

CREATE POLICY "premissas_default_tenant_update"
  ON public.premissas_default_tenant FOR UPDATE
  USING (tenant_id = (SELECT get_user_tenant_id()))
  WITH CHECK (tenant_id = (SELECT get_user_tenant_id()));

CREATE TRIGGER update_premissas_default_updated_at
  BEFORE UPDATE ON public.premissas_default_tenant
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5) Índices compostos para performance
CREATE INDEX IF NOT EXISTS idx_proposta_versoes_proposta_numero
  ON public.proposta_versoes (proposta_id, versao_numero DESC);

CREATE INDEX IF NOT EXISTS idx_proposta_series_versao_uc
  ON public.proposta_series (versao_id, uc_index);

CREATE INDEX IF NOT EXISTS idx_propostas_nativas_tenant_status
  ON public.propostas_nativas (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_propostas_nativas_lead
  ON public.propostas_nativas (lead_id) WHERE lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_propostas_nativas_cliente
  ON public.propostas_nativas (cliente_id) WHERE cliente_id IS NOT NULL;

-- 6) Documentação
COMMENT ON TABLE public.propostas_sm_legado IS 'DEPRECATED: Tabela legada de sync SolarMarket. Usar propostas_nativas com origem=imported.';
COMMENT ON COLUMN public.propostas_nativas.origem IS 'native = criada no wizard | imported = sync SolarMarket';
COMMENT ON TABLE public.premissas_default_tenant IS 'Premissas financeiras/técnicas default por tenant, usadas como seed no wizard';
