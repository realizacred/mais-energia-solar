
-- ============================================================
-- tenant_premises: canonical premissas per tenant (1 row each)
-- Replaces the old premissas_tecnicas as the comprehensive source
-- ============================================================

CREATE TABLE public.tenant_premises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- ── Tab 1: Financeiras ──
  inflacao_energetica NUMERIC NOT NULL DEFAULT 9.50,
  vpl_taxa_desconto NUMERIC NOT NULL DEFAULT 12.00,
  considerar_custo_disponibilidade BOOLEAN NOT NULL DEFAULT true,

  -- ── Tab 2: Sistema Solar ──
  base_irradiancia TEXT NOT NULL DEFAULT 'inpe_2017',
  sobredimensionamento_padrao NUMERIC NOT NULL DEFAULT 20.00,
  perda_eficiencia_tradicional NUMERIC NOT NULL DEFAULT 0.80,
  perda_eficiencia_microinversor NUMERIC NOT NULL DEFAULT 0.50,
  perda_eficiencia_otimizador NUMERIC NOT NULL DEFAULT 0.50,
  troca_inversor_anos_tradicional INTEGER NOT NULL DEFAULT 10,
  troca_inversor_anos_microinversor INTEGER NOT NULL DEFAULT 10,
  troca_inversor_anos_otimizador INTEGER NOT NULL DEFAULT 10,
  custo_troca_inversor_tradicional NUMERIC NOT NULL DEFAULT 0.00,
  custo_troca_inversor_microinversor NUMERIC NOT NULL DEFAULT 0.00,
  custo_troca_inversor_otimizador NUMERIC NOT NULL DEFAULT 0.00,
  margem_potencia_ideal NUMERIC NOT NULL DEFAULT 0.00,
  considerar_custo_disponibilidade_solar BOOLEAN NOT NULL DEFAULT true,

  -- ── Tab 4: Valores Padrões ──
  grupo_tarifario TEXT NOT NULL DEFAULT 'BT',
  tarifa NUMERIC NOT NULL DEFAULT 0.99027,
  tarifa_te_ponta NUMERIC NOT NULL DEFAULT 0.00,
  tarifa_tusd_ponta NUMERIC NOT NULL DEFAULT 0.00,
  tarifa_te_fora_ponta NUMERIC NOT NULL DEFAULT 0.00,
  tarifa_tusd_fora_ponta NUMERIC NOT NULL DEFAULT 0.00,
  tusd_fio_b_bt NUMERIC NOT NULL DEFAULT 0.19703,
  tusd_fio_b_fora_ponta NUMERIC NOT NULL DEFAULT 0.00,
  tusd_fio_b_ponta NUMERIC NOT NULL DEFAULT 0.00,
  tarifacao_compensada_bt NUMERIC NOT NULL DEFAULT 1.97031,
  tarifacao_compensada_fora_ponta NUMERIC NOT NULL DEFAULT 0.00,
  tarifacao_compensada_ponta NUMERIC NOT NULL DEFAULT 0.00,
  preco_demanda_geracao NUMERIC NOT NULL DEFAULT 0.00,
  preco_demanda NUMERIC NOT NULL DEFAULT 0.00,
  fase_tensao_rede TEXT NOT NULL DEFAULT 'bifasico_127_220',
  fator_simultaneidade NUMERIC NOT NULL DEFAULT 30.00,
  imposto_energia NUMERIC NOT NULL DEFAULT 0.00,
  outros_encargos_atual NUMERIC NOT NULL DEFAULT 0.00,
  outros_encargos_novo NUMERIC NOT NULL DEFAULT 0.00,
  tipo_telhado_padrao TEXT NOT NULL DEFAULT 'metalico',
  desvio_azimutal INTEGER NOT NULL DEFAULT 0,
  inclinacao_modulos INTEGER NOT NULL DEFAULT 20,
  topologias TEXT[] NOT NULL DEFAULT ARRAY['tradicional','microinversor','otimizador'],
  tipo_sistema TEXT NOT NULL DEFAULT 'on_grid',
  taxa_desempenho_tradicional NUMERIC NOT NULL DEFAULT 69.80,
  taxa_desempenho_microinversor NUMERIC NOT NULL DEFAULT 72.00,
  taxa_desempenho_otimizador NUMERIC NOT NULL DEFAULT 74.00,
  tipo_kits TEXT[] NOT NULL DEFAULT ARRAY['fechados','customizados'],
  considerar_kits_transformador BOOLEAN NOT NULL DEFAULT true,
  tipo_preco TEXT NOT NULL DEFAULT 'equipamentos',
  dod NUMERIC NOT NULL DEFAULT 80.00,
  fornecedor_filtro TEXT NOT NULL DEFAULT 'qualquer',

  -- ── Audit ──
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),

  CONSTRAINT uq_tenant_premises_tenant UNIQUE(tenant_id)
);

-- RLS
ALTER TABLE public.tenant_premises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_premises_select" ON public.tenant_premises
  FOR SELECT USING (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_premises_insert" ON public.tenant_premises
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_premises_update" ON public.tenant_premises
  FOR UPDATE USING (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_premises_delete" ON public.tenant_premises
  FOR DELETE USING (tenant_id = get_user_tenant_id());

-- Auto updated_at
CREATE TRIGGER update_tenant_premises_updated_at
  BEFORE UPDATE ON public.tenant_premises
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- tenant_roof_area_factors: area factor per roof type per tenant
-- ============================================================

CREATE TABLE public.tenant_roof_area_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tipo_telhado TEXT NOT NULL,
  fator_area NUMERIC NOT NULL DEFAULT 1.20,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_tenant_roof_type UNIQUE(tenant_id, tipo_telhado)
);

ALTER TABLE public.tenant_roof_area_factors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_roof_select" ON public.tenant_roof_area_factors
  FOR SELECT USING (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_roof_insert" ON public.tenant_roof_area_factors
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_roof_update" ON public.tenant_roof_area_factors
  FOR UPDATE USING (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_roof_delete" ON public.tenant_roof_area_factors
  FOR DELETE USING (tenant_id = get_user_tenant_id());

CREATE TRIGGER update_tenant_roof_updated_at
  BEFORE UPDATE ON public.tenant_roof_area_factors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Index for tenant lookups
CREATE INDEX idx_tenant_premises_tenant ON public.tenant_premises(tenant_id);
CREATE INDEX idx_tenant_roof_factors_tenant ON public.tenant_roof_area_factors(tenant_id);
