
-- ============================================================
-- FASE 1: Foundation — Tabelas do Wizard de Propostas Completo
-- ============================================================

-- 1) Unidades Consumidoras por versão de proposta (repetível)
CREATE TABLE public.proposta_ucs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  versao_id UUID NOT NULL REFERENCES public.proposta_versoes(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  uc_index SMALLINT NOT NULL DEFAULT 1, -- uc1, uc2...
  nome TEXT,
  tipo_dimensionamento TEXT DEFAULT 'BT' CHECK (tipo_dimensionamento IN ('BT', 'MT')),
  distribuidora TEXT,
  subgrupo TEXT,
  estado TEXT,
  cidade TEXT,
  fase TEXT CHECK (fase IN ('monofasico', 'bifasico', 'trifasico')),
  tensao_rede TEXT,
  -- Consumo BT
  consumo_mensal NUMERIC,
  consumo_jan NUMERIC, consumo_fev NUMERIC, consumo_mar NUMERIC,
  consumo_abr NUMERIC, consumo_mai NUMERIC, consumo_jun NUMERIC,
  consumo_jul NUMERIC, consumo_ago NUMERIC, consumo_set NUMERIC,
  consumo_out NUMERIC, consumo_nov NUMERIC, consumo_dez NUMERIC,
  -- Consumo MT (ponta/fora ponta)
  consumo_mensal_p NUMERIC, consumo_mensal_fp NUMERIC,
  -- Tarifas
  tarifa_distribuidora NUMERIC,
  tarifa_te_p NUMERIC, tarifa_tusd_p NUMERIC,
  tarifa_te_fp NUMERIC, tarifa_tusd_fp NUMERIC,
  -- Demanda MT
  demanda_preco NUMERIC, demanda_contratada NUMERIC,
  demanda_adicional NUMERIC, demanda_g NUMERIC, demanda_g_preco NUMERIC,
  -- Custos/encargos
  custo_disponibilidade_kwh NUMERIC, custo_disponibilidade_valor NUMERIC,
  outros_encargos_atual NUMERIC, outros_encargos_novo NUMERIC,
  -- Localização técnica
  distancia NUMERIC,
  tipo_telhado TEXT, inclinacao NUMERIC, desvio_azimutal NUMERIC,
  taxa_desempenho NUMERIC,
  -- Compensação
  regra_compensacao SMALLINT DEFAULT 0, -- 0=GD-I, 1=GD-II, 2=GD-III
  rateio_sugerido_creditos NUMERIC, rateio_creditos NUMERIC,
  imposto_energia NUMERIC,
  fator_simultaneidade NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposta_ucs_versao ON proposta_ucs(versao_id);
CREATE INDEX idx_proposta_ucs_tenant ON proposta_ucs(tenant_id);
ALTER TABLE public.proposta_ucs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proposta_ucs_tenant_select" ON proposta_ucs FOR SELECT
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "proposta_ucs_tenant_insert" ON proposta_ucs FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "proposta_ucs_tenant_update" ON proposta_ucs FOR UPDATE
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "proposta_ucs_tenant_delete" ON proposta_ucs FOR DELETE
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());

-- 2) Premissas por versão de proposta
CREATE TABLE public.proposta_premissas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  versao_id UUID NOT NULL REFERENCES public.proposta_versoes(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  imposto NUMERIC DEFAULT 0,
  inflacao_energetica NUMERIC DEFAULT 6.5,
  inflacao_ipca NUMERIC DEFAULT 4.5,
  perda_eficiencia_anual NUMERIC DEFAULT 0.5,
  sobredimensionamento NUMERIC DEFAULT 0,
  troca_inversor_anos INTEGER DEFAULT 15,
  troca_inversor_custo NUMERIC DEFAULT 30,
  vpl_taxa_desconto NUMERIC DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(versao_id)
);

CREATE INDEX idx_proposta_premissas_tenant ON proposta_premissas(tenant_id);
ALTER TABLE public.proposta_premissas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proposta_premissas_tenant_select" ON proposta_premissas FOR SELECT
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "proposta_premissas_tenant_insert" ON proposta_premissas FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "proposta_premissas_tenant_update" ON proposta_premissas FOR UPDATE
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "proposta_premissas_tenant_delete" ON proposta_premissas FOR DELETE
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());

-- 3) Kit da proposta (fechado ou customizado)
CREATE TABLE public.proposta_kits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  versao_id UUID NOT NULL REFERENCES public.proposta_versoes(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  tipo_kit TEXT NOT NULL DEFAULT 'customizado' CHECK (tipo_kit IN ('fechado', 'customizado')),
  tipo_sistema TEXT DEFAULT 'on_grid' CHECK (tipo_sistema IN ('on_grid', 'hibrido', 'off_grid')),
  topologia TEXT DEFAULT 'tradicional' CHECK (topologia IN ('tradicional', 'microinversor', 'otimizador')),
  kit_fechado_ref TEXT, -- referência ao kit do catálogo se tipo=fechado
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(versao_id)
);

CREATE INDEX idx_proposta_kits_tenant ON proposta_kits(tenant_id);
ALTER TABLE public.proposta_kits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proposta_kits_tenant_select" ON proposta_kits FOR SELECT
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "proposta_kits_tenant_insert" ON proposta_kits FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "proposta_kits_tenant_update" ON proposta_kits FOR UPDATE
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "proposta_kits_tenant_delete" ON proposta_kits FOR DELETE
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());

-- 4) Itens do kit (módulos, inversores, estrutura, etc.)
CREATE TABLE public.proposta_kit_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kit_id UUID NOT NULL REFERENCES public.proposta_kits(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  categoria TEXT NOT NULL CHECK (categoria IN ('modulo', 'inversor', 'otimizador', 'estrutura', 'componente', 'bateria')),
  produto_ref TEXT, -- referência ao catálogo (id ou SKU)
  descricao TEXT NOT NULL,
  fabricante TEXT,
  modelo TEXT,
  potencia_w NUMERIC,
  quantidade INTEGER NOT NULL DEFAULT 1,
  preco_unitario NUMERIC NOT NULL DEFAULT 0,
  avulso BOOLEAN DEFAULT false,
  ordem SMALLINT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposta_kit_itens_kit ON proposta_kit_itens(kit_id);
CREATE INDEX idx_proposta_kit_itens_tenant ON proposta_kit_itens(tenant_id);
ALTER TABLE public.proposta_kit_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proposta_kit_itens_tenant_select" ON proposta_kit_itens FOR SELECT
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "proposta_kit_itens_tenant_insert" ON proposta_kit_itens FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "proposta_kit_itens_tenant_update" ON proposta_kit_itens FOR UPDATE
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "proposta_kit_itens_tenant_delete" ON proposta_kit_itens FOR DELETE
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());

-- 5) Layout de módulos (arranjos)
CREATE TABLE public.proposta_layout_modulos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kit_id UUID NOT NULL REFERENCES public.proposta_kits(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  arranjo_index SMALLINT NOT NULL DEFAULT 1,
  num_linhas INTEGER NOT NULL DEFAULT 1,
  modulos_por_linha INTEGER NOT NULL DEFAULT 1,
  disposicao TEXT DEFAULT 'horizontal' CHECK (disposicao IN ('horizontal', 'vertical')),
  inclinacao NUMERIC,
  orientacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposta_layout_kit ON proposta_layout_modulos(kit_id);
ALTER TABLE public.proposta_layout_modulos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proposta_layout_tenant_select" ON proposta_layout_modulos FOR SELECT
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "proposta_layout_tenant_insert" ON proposta_layout_modulos FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "proposta_layout_tenant_update" ON proposta_layout_modulos FOR UPDATE
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "proposta_layout_tenant_delete" ON proposta_layout_modulos FOR DELETE
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());

-- 6) Serviços adicionais da proposta
CREATE TABLE public.proposta_servicos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  versao_id UUID NOT NULL REFERENCES public.proposta_versoes(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  descricao TEXT NOT NULL,
  categoria TEXT, -- 'instalacao', 'comissao', 'projeto', 'outros'
  valor NUMERIC NOT NULL DEFAULT 0,
  incluso_no_preco BOOLEAN DEFAULT true,
  ordem SMALLINT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposta_servicos_versao ON proposta_servicos(versao_id);
CREATE INDEX idx_proposta_servicos_tenant ON proposta_servicos(tenant_id);
ALTER TABLE public.proposta_servicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proposta_servicos_tenant_select" ON proposta_servicos FOR SELECT
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "proposta_servicos_tenant_insert" ON proposta_servicos FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "proposta_servicos_tenant_update" ON proposta_servicos FOR UPDATE
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "proposta_servicos_tenant_delete" ON proposta_servicos FOR DELETE
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());

-- 7) Dados de venda / precificação detalhada
CREATE TABLE public.proposta_venda (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  versao_id UUID NOT NULL REFERENCES public.proposta_versoes(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  custo_kit NUMERIC DEFAULT 0,
  custo_instalacao NUMERIC DEFAULT 0,
  custo_comissao NUMERIC DEFAULT 0,
  custo_outros NUMERIC DEFAULT 0,
  custo_total NUMERIC DEFAULT 0,
  margem_percentual NUMERIC DEFAULT 20,
  markup NUMERIC DEFAULT 0,
  desconto_percentual NUMERIC DEFAULT 0,
  desconto_valor NUMERIC DEFAULT 0,
  preco_final NUMERIC DEFAULT 0,
  preco_por_kwp NUMERIC,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(versao_id)
);

CREATE INDEX idx_proposta_venda_tenant ON proposta_venda(tenant_id);
ALTER TABLE public.proposta_venda ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proposta_venda_tenant_select" ON proposta_venda FOR SELECT
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "proposta_venda_tenant_insert" ON proposta_venda FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "proposta_venda_tenant_update" ON proposta_venda FOR UPDATE
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "proposta_venda_tenant_delete" ON proposta_venda FOR DELETE
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());

-- 8) Opções de pagamento/financiamento (múltiplas por versão)
CREATE TABLE public.proposta_pagamento_opcoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  versao_id UUID NOT NULL REFERENCES public.proposta_versoes(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  nome TEXT NOT NULL, -- "BV Financeira", "À vista", etc.
  tipo TEXT DEFAULT 'financiamento' CHECK (tipo IN ('a_vista', 'financiamento', 'parcelado', 'outro')),
  valor_financiado NUMERIC DEFAULT 0,
  entrada NUMERIC DEFAULT 0,
  taxa_mensal NUMERIC DEFAULT 0,
  carencia_meses INTEGER DEFAULT 0,
  num_parcelas INTEGER DEFAULT 0,
  valor_parcela NUMERIC DEFAULT 0,
  observacoes TEXT,
  ordem SMALLINT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposta_pagamento_versao ON proposta_pagamento_opcoes(versao_id);
CREATE INDEX idx_proposta_pagamento_tenant ON proposta_pagamento_opcoes(tenant_id);
ALTER TABLE public.proposta_pagamento_opcoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proposta_pagamento_tenant_select" ON proposta_pagamento_opcoes FOR SELECT
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "proposta_pagamento_tenant_insert" ON proposta_pagamento_opcoes FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "proposta_pagamento_tenant_update" ON proposta_pagamento_opcoes FOR UPDATE
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "proposta_pagamento_tenant_delete" ON proposta_pagamento_opcoes FOR DELETE
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());

-- 9) Séries calculadas (output do motor — readonly, versionado)
CREATE TABLE public.proposta_series (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  versao_id UUID NOT NULL REFERENCES public.proposta_versoes(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  serie_key TEXT NOT NULL, -- 's_economia_anual', 's_fluxo_caixa_acumulado_anual', etc.
  uc_index SMALLINT, -- NULL = agregado, 1 = uc1, 2 = uc2...
  data_points JSONB NOT NULL DEFAULT '[]', -- [{x: 2025, y: 1200}, ...]
  unidade TEXT, -- 'R$', 'kWh', '%'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(versao_id, serie_key, uc_index)
);

CREATE INDEX idx_proposta_series_versao ON proposta_series(versao_id);
CREATE INDEX idx_proposta_series_tenant ON proposta_series(tenant_id);
ALTER TABLE public.proposta_series ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proposta_series_tenant_select" ON proposta_series FOR SELECT
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "proposta_series_tenant_insert" ON proposta_series FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "proposta_series_tenant_update" ON proposta_series FOR UPDATE
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "proposta_series_tenant_delete" ON proposta_series FOR DELETE
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());

-- 10) Campos customizados do distribuidor (schema-driven)
CREATE TABLE public.proposta_campos_distribuidora (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  versao_id UUID NOT NULL REFERENCES public.proposta_versoes(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  campo_key TEXT NOT NULL, -- 'cdd_comunicador', 'cdd_tipo_estrutura', etc.
  valor TEXT,
  valor_boolean BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(versao_id, campo_key)
);

CREATE INDEX idx_proposta_campos_dist_versao ON proposta_campos_distribuidora(versao_id);
ALTER TABLE public.proposta_campos_distribuidora ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proposta_campos_dist_tenant_select" ON proposta_campos_distribuidora FOR SELECT
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "proposta_campos_dist_tenant_insert" ON proposta_campos_distribuidora FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "proposta_campos_dist_tenant_update" ON proposta_campos_distribuidora FOR UPDATE
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "proposta_campos_dist_tenant_delete" ON proposta_campos_distribuidora FOR DELETE
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());

-- 11) Dados comerciais da proposta (responsável, representante, empresa)
CREATE TABLE public.proposta_comercial (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  versao_id UUID NOT NULL REFERENCES public.proposta_versoes(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  responsavel_nome TEXT,
  responsavel_email TEXT,
  responsavel_celular TEXT,
  representante_nome TEXT,
  representante_email TEXT,
  representante_celular TEXT,
  projeto_id_externo TEXT,
  empresa_nome TEXT,
  empresa_cnpj_cpf TEXT,
  empresa_estado TEXT,
  empresa_cidade TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(versao_id)
);

CREATE INDEX idx_proposta_comercial_tenant ON proposta_comercial(tenant_id);
ALTER TABLE public.proposta_comercial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proposta_comercial_tenant_select" ON proposta_comercial FOR SELECT
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "proposta_comercial_tenant_insert" ON proposta_comercial FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "proposta_comercial_tenant_update" ON proposta_comercial FOR UPDATE
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "proposta_comercial_tenant_delete" ON proposta_comercial FOR DELETE
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());

-- 12) Resultados calculados da conta de energia (output por UC — readonly)
CREATE TABLE public.proposta_resultados_energia (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  versao_id UUID NOT NULL REFERENCES public.proposta_versoes(id) ON DELETE CASCADE,
  uc_id UUID REFERENCES public.proposta_ucs(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  -- Gastos atuais vs novos
  gasto_energia_mensal_atual NUMERIC,
  gasto_energia_mensal_novo NUMERIC,
  gasto_demanda_mensal_atual NUMERIC,
  gasto_demanda_mensal_novo NUMERIC,
  gasto_total_mensal_atual NUMERIC,
  gasto_total_mensal_novo NUMERIC,
  -- Economia
  economia_energia_mensal NUMERIC,
  economia_energia_percentual NUMERIC,
  economia_demanda_mensal NUMERIC,
  economia_total_mensal NUMERIC,
  economia_total_anual NUMERIC,
  -- Créditos
  creditos_alocados NUMERIC,
  consumo_abatido NUMERIC,
  -- Tarifação compensada
  tarifacao_energia_compensada_bt NUMERIC,
  tarifacao_energia_compensada_fp NUMERIC,
  tarifacao_energia_compensada_p NUMERIC,
  -- Impostos
  valor_imposto_energia NUMERIC,
  -- Saldos mensais de créditos
  creditos_jan NUMERIC, creditos_fev NUMERIC, creditos_mar NUMERIC,
  creditos_abr NUMERIC, creditos_mai NUMERIC, creditos_jun NUMERIC,
  creditos_jul NUMERIC, creditos_ago NUMERIC, creditos_set NUMERIC,
  creditos_out NUMERIC, creditos_nov NUMERIC, creditos_dez NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(versao_id, uc_id)
);

CREATE INDEX idx_proposta_result_energia_versao ON proposta_resultados_energia(versao_id);
CREATE INDEX idx_proposta_result_energia_tenant ON proposta_resultados_energia(tenant_id);
ALTER TABLE public.proposta_resultados_energia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proposta_result_energia_tenant_select" ON proposta_resultados_energia FOR SELECT
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "proposta_result_energia_tenant_insert" ON proposta_resultados_energia FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "proposta_result_energia_tenant_update" ON proposta_resultados_energia FOR UPDATE
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "proposta_result_energia_tenant_delete" ON proposta_resultados_energia FOR DELETE
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
