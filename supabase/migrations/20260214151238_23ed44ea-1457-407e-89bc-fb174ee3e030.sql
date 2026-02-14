
-- ============================================================
-- F1: SCHEMA RELACIONAL DE PROPOSTAS — Evolução Arquitetural
-- ============================================================
-- Objetivo: Extrair dados do JSONB monolítico (proposta_versoes.snapshot)
-- para tabelas relacionais queryáveis, mantendo compatibilidade retroativa.
-- O snapshot JSONB continua existindo como "freeze" de auditoria.
-- ============================================================

-- 1. Adicionar calc_hash e engine_version ao proposta_versoes
ALTER TABLE proposta_versoes
  ADD COLUMN IF NOT EXISTS calc_hash TEXT,
  ADD COLUMN IF NOT EXISTS engine_version TEXT DEFAULT '1.0.0';

COMMENT ON COLUMN proposta_versoes.calc_hash IS 'SHA-256 do input normalizado para auditoria de determinismo';
COMMENT ON COLUMN proposta_versoes.engine_version IS 'Versão do motor de cálculo usado na geração';

-- 2. Cenários de Proposta (variações: à vista, financiado A, financiado B)
CREATE TABLE IF NOT EXISTS proposta_cenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  versao_id UUID NOT NULL REFERENCES proposta_versoes(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  nome TEXT NOT NULL, -- 'À Vista', 'Financiamento BV', 'Financiamento Sicredi'
  tipo TEXT NOT NULL DEFAULT 'a_vista', -- 'a_vista' | 'financiado' | 'consorcio' | 'custom'
  is_default BOOLEAN NOT NULL DEFAULT false,
  -- Precificação
  custo_equipamentos NUMERIC DEFAULT 0,
  custo_servicos NUMERIC DEFAULT 0,
  custo_total NUMERIC DEFAULT 0,
  markup_percent NUMERIC DEFAULT 0,
  margem_percent NUMERIC DEFAULT 0,
  comissao_percent NUMERIC DEFAULT 0,
  comissao_valor NUMERIC DEFAULT 0,
  preco_final NUMERIC DEFAULT 0,
  preco_por_kwp NUMERIC DEFAULT 0,
  -- Pagamento
  entrada_valor NUMERIC DEFAULT 0,
  entrada_percent NUMERIC DEFAULT 0,
  num_parcelas INTEGER DEFAULT 1,
  valor_parcela NUMERIC DEFAULT 0,
  -- Financiamento
  financiador_id UUID REFERENCES financiamento_bancos(id),
  taxa_juros_mensal NUMERIC,
  taxa_juros_anual NUMERIC,
  cet_anual NUMERIC,
  valor_financiado NUMERIC DEFAULT 0,
  -- Calculado
  payback_meses INTEGER,
  tir_anual NUMERIC,
  roi_25_anos NUMERIC,
  economia_primeiro_ano NUMERIC,
  -- Metadata
  ordem INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cenarios_versao ON proposta_cenarios(versao_id);
CREATE INDEX idx_cenarios_tenant ON proposta_cenarios(tenant_id);

-- 3. Unidades Consumidoras por Versão (coleção N linhas — NUNCA uc1..uc8)
CREATE TABLE IF NOT EXISTS proposta_versao_ucs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  versao_id UUID NOT NULL REFERENCES proposta_versoes(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  ordem INTEGER NOT NULL DEFAULT 1,
  -- Dados da UC
  nome TEXT, -- 'Residência Principal', 'Escritório', etc.
  numero_uc TEXT, -- Número de instalação
  titular TEXT,
  concessionaria_id UUID REFERENCES concessionarias(id),
  tipo_ligacao TEXT DEFAULT 'monofasico', -- 'monofasico' | 'bifasico' | 'trifasico'
  grupo TEXT DEFAULT 'B', -- 'A' | 'B'
  modalidade TEXT DEFAULT 'convencional', -- 'convencional' | 'branca' | 'verde' | 'azul'
  -- Consumo
  consumo_mensal_kwh NUMERIC NOT NULL DEFAULT 0,
  consumo_ponta_kwh NUMERIC DEFAULT 0,
  consumo_fora_ponta_kwh NUMERIC DEFAULT 0,
  demanda_contratada_kw NUMERIC,
  -- Tarifa
  tarifa_energia NUMERIC,
  tarifa_fio_b NUMERIC,
  tarifa_ponta NUMERIC,
  tarifa_fora_ponta NUMERIC,
  aliquota_icms NUMERIC,
  -- Dimensionamento
  percentual_atendimento NUMERIC DEFAULT 100,
  potencia_necessaria_kwp NUMERIC,
  geracao_mensal_estimada NUMERIC,
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ucs_versao ON proposta_versao_ucs(versao_id);

-- 4. Séries Temporais (25 anos — linhas, NUNCA colunas fixas)
CREATE TABLE IF NOT EXISTS proposta_versao_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  versao_id UUID NOT NULL REFERENCES proposta_versoes(id) ON DELETE CASCADE,
  cenario_id UUID REFERENCES proposta_cenarios(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  ano INTEGER NOT NULL, -- 0..25
  mes INTEGER, -- 1..12 (null = dado anual)
  -- Valores
  geracao_kwh NUMERIC DEFAULT 0,
  economia_rs NUMERIC DEFAULT 0,
  economia_acumulada_rs NUMERIC DEFAULT 0,
  tarifa_vigente NUMERIC DEFAULT 0,
  degradacao_acumulada NUMERIC DEFAULT 0,
  custo_om NUMERIC DEFAULT 0, -- operação e manutenção
  fluxo_caixa NUMERIC DEFAULT 0,
  fluxo_caixa_acumulado NUMERIC DEFAULT 0,
  parcela_financiamento NUMERIC DEFAULT 0,
  saldo_devedor NUMERIC DEFAULT 0,
  -- Metadata
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_series_versao ON proposta_versao_series(versao_id, ano, mes);
CREATE INDEX idx_series_cenario ON proposta_versao_series(cenario_id) WHERE cenario_id IS NOT NULL;

-- 5. Serviços por Versão
CREATE TABLE IF NOT EXISTS proposta_versao_servicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  versao_id UUID NOT NULL REFERENCES proposta_versoes(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  tipo TEXT NOT NULL, -- 'instalacao' | 'projeto' | 'homologacao' | 'frete' | 'seguro' | 'comissao' | 'custom'
  descricao TEXT NOT NULL,
  valor NUMERIC NOT NULL DEFAULT 0,
  incluso BOOLEAN DEFAULT true, -- incluso no preço ou cobrado à parte
  obrigatorio BOOLEAN DEFAULT false,
  ordem INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_servicos_versao ON proposta_versao_servicos(versao_id);

-- 6. Configuração de Precificação por Tenant
CREATE TABLE IF NOT EXISTS pricing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  -- Markups padrão
  markup_equipamentos_percent NUMERIC DEFAULT 30,
  markup_servicos_percent NUMERIC DEFAULT 20,
  margem_minima_percent NUMERIC DEFAULT 15,
  -- Comissão
  comissao_padrao_percent NUMERIC DEFAULT 5,
  comissao_gerente_percent NUMERIC DEFAULT 2,
  -- Preço por kWp
  preco_kwp_minimo NUMERIC,
  preco_kwp_maximo NUMERIC,
  preco_kwp_sugerido NUMERIC,
  -- Desconto
  desconto_maximo_percent NUMERIC DEFAULT 10,
  requer_aprovacao_desconto BOOLEAN DEFAULT true,
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pricing_config_tenant_unique UNIQUE (tenant_id)
);

-- 7. Premissas Técnicas por Tenant (unificando calculadora_config + payback_config)
CREATE TABLE IF NOT EXISTS premissas_tecnicas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  -- Geração
  irradiacao_media_kwh_m2 NUMERIC DEFAULT 4.5,
  fator_perdas_percent NUMERIC DEFAULT 15,
  degradacao_anual_percent NUMERIC DEFAULT 0.7,
  performance_ratio NUMERIC DEFAULT 0.82,
  -- Sistema
  vida_util_anos INTEGER DEFAULT 25,
  horas_sol_pico NUMERIC DEFAULT 4.5,
  -- Tarifário
  reajuste_tarifa_anual_percent NUMERIC DEFAULT 6,
  taxa_selic_anual NUMERIC DEFAULT 11.25,
  ipca_anual NUMERIC DEFAULT 4.5,
  -- Custos padrão
  custo_disponibilidade_mono NUMERIC DEFAULT 100,
  custo_disponibilidade_bi NUMERIC DEFAULT 160,
  custo_disponibilidade_tri NUMERIC DEFAULT 200,
  taxas_fixas_mensais NUMERIC DEFAULT 0,
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT premissas_tecnicas_tenant_unique UNIQUE (tenant_id)
);

-- ============================================================
-- RLS POLICIES
-- ============================================================

ALTER TABLE proposta_cenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposta_versao_ucs ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposta_versao_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposta_versao_servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE premissas_tecnicas ENABLE ROW LEVEL SECURITY;

-- Cenários
CREATE POLICY "Tenant isolation" ON proposta_cenarios
  FOR ALL USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- UCs
CREATE POLICY "Tenant isolation" ON proposta_versao_ucs
  FOR ALL USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- Séries
CREATE POLICY "Tenant isolation" ON proposta_versao_series
  FOR ALL USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- Serviços
CREATE POLICY "Tenant isolation" ON proposta_versao_servicos
  FOR ALL USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- Pricing Config
CREATE POLICY "Tenant isolation" ON pricing_config
  FOR ALL USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- Premissas Técnicas
CREATE POLICY "Tenant isolation" ON premissas_tecnicas
  FOR ALL USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- ============================================================
-- TRIGGERS: updated_at automático
-- ============================================================

CREATE TRIGGER update_proposta_cenarios_updated_at
  BEFORE UPDATE ON proposta_cenarios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pricing_config_updated_at
  BEFORE UPDATE ON pricing_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_premissas_tecnicas_updated_at
  BEFORE UPDATE ON premissas_tecnicas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- AUDIT TRIGGERS (append-only)
-- ============================================================
-- Cenários e pricing são dados sensíveis que devem ser auditados

CREATE TRIGGER audit_proposta_cenarios
  AFTER INSERT OR UPDATE OR DELETE ON proposta_cenarios
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger_fn();

CREATE TRIGGER audit_pricing_config
  AFTER INSERT OR UPDATE OR DELETE ON pricing_config
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger_fn();

CREATE TRIGGER audit_premissas_tecnicas
  AFTER INSERT OR UPDATE OR DELETE ON premissas_tecnicas
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger_fn();
