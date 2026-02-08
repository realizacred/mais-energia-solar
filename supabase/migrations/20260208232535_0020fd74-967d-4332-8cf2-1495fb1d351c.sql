
-- =============================================
-- MÓDULO PROPOSTAS - Tabelas principais
-- =============================================

-- 1. Tabela principal de propostas
CREATE TABLE public.propostas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) DEFAULT (get_user_tenant_id()),
  
  -- IDs SolarMarket
  sm_id TEXT UNIQUE,
  sm_project_id TEXT,
  sm_project_name TEXT,
  
  -- Dados principais
  nome TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  link_pdf TEXT,
  
  -- Datas do SolarMarket
  created_at_sm TIMESTAMPTZ,
  generated_at TIMESTAMPTZ,
  expiration_date TIMESTAMPTZ,
  
  -- Dados do cliente (extraídos de variables)
  cliente_nome TEXT,
  cliente_celular TEXT,
  cliente_email TEXT,
  cliente_endereco TEXT,
  cliente_cidade TEXT,
  cliente_estado TEXT,
  cliente_cep TEXT,
  distribuidora TEXT,
  
  -- Resumo técnico (extraídos de variables)
  potencia_kwp NUMERIC,
  geracao_mensal_kwh NUMERIC,
  economia_mensal NUMERIC,
  payback_anos NUMERIC,
  preco_total NUMERIC,
  area_necessaria NUMERIC,
  numero_modulos INTEGER,
  modelo_modulo TEXT,
  modelo_inversor TEXT,
  
  -- Séries numéricas (extraídas de variables com arrays)
  serie_consumo_mensal NUMERIC[],
  serie_geracao_mensal NUMERIC[],
  serie_economia_anual NUMERIC[],
  
  -- JSON completo do SolarMarket
  raw_payload JSONB,
  
  -- Vínculo com vendedor
  vendedor_id UUID REFERENCES public.vendedores(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tabela de itens da proposta (pricingTable)
CREATE TABLE public.proposta_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposta_id UUID NOT NULL REFERENCES public.propostas(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) DEFAULT (get_user_tenant_id()),
  
  category TEXT,
  item TEXT NOT NULL,
  quantidade NUMERIC NOT NULL DEFAULT 1,
  custo_unitario NUMERIC NOT NULL DEFAULT 0,
  custo_total NUMERIC NOT NULL DEFAULT 0,
  valor_venda NUMERIC NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Tabela de variáveis da proposta (todas as variables do SolarMarket)
CREATE TABLE public.proposta_variaveis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposta_id UUID NOT NULL REFERENCES public.propostas(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) DEFAULT (get_user_tenant_id()),
  
  key TEXT NOT NULL,
  topic TEXT,
  item TEXT,
  value TEXT,
  formatted_value TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- ÍNDICES
-- =============================================
CREATE INDEX idx_propostas_sm_id ON public.propostas(sm_id);
CREATE INDEX idx_propostas_status ON public.propostas(status);
CREATE INDEX idx_propostas_vendedor_id ON public.propostas(vendedor_id);
CREATE INDEX idx_propostas_cliente_nome ON public.propostas(cliente_nome);
CREATE INDEX idx_propostas_created_at ON public.propostas(created_at DESC);
CREATE INDEX idx_propostas_tenant_id ON public.propostas(tenant_id);

CREATE INDEX idx_proposta_itens_proposta_id ON public.proposta_itens(proposta_id);
CREATE INDEX idx_proposta_variaveis_proposta_id ON public.proposta_variaveis(proposta_id);
CREATE INDEX idx_proposta_variaveis_key ON public.proposta_variaveis(key);

-- =============================================
-- RLS - Row Level Security
-- =============================================

-- Propostas
ALTER TABLE public.propostas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver todas as propostas"
  ON public.propostas FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Vendedores podem ver suas propostas"
  ON public.propostas FOR SELECT
  USING (
    vendedor_id IN (
      SELECT id FROM vendedores WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins podem inserir propostas"
  ON public.propostas FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins podem atualizar propostas"
  ON public.propostas FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins podem deletar propostas"
  ON public.propostas FOR DELETE
  USING (is_admin(auth.uid()));

-- Proposta Itens
ALTER TABLE public.proposta_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver todos os itens"
  ON public.proposta_itens FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Vendedores podem ver itens de suas propostas"
  ON public.proposta_itens FOR SELECT
  USING (
    proposta_id IN (
      SELECT p.id FROM propostas p
      WHERE p.vendedor_id IN (
        SELECT v.id FROM vendedores v WHERE v.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins podem inserir itens"
  ON public.proposta_itens FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins podem atualizar itens"
  ON public.proposta_itens FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins podem deletar itens"
  ON public.proposta_itens FOR DELETE
  USING (is_admin(auth.uid()));

-- Proposta Variáveis
ALTER TABLE public.proposta_variaveis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver todas as variáveis"
  ON public.proposta_variaveis FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Vendedores podem ver variáveis de suas propostas"
  ON public.proposta_variaveis FOR SELECT
  USING (
    proposta_id IN (
      SELECT p.id FROM propostas p
      WHERE p.vendedor_id IN (
        SELECT v.id FROM vendedores v WHERE v.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins podem inserir variáveis"
  ON public.proposta_variaveis FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins podem atualizar variáveis"
  ON public.proposta_variaveis FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins podem deletar variáveis"
  ON public.proposta_variaveis FOR DELETE
  USING (is_admin(auth.uid()));

-- =============================================
-- TRIGGERS
-- =============================================

-- updated_at automático
CREATE TRIGGER update_propostas_updated_at
  BEFORE UPDATE ON public.propostas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Audit logs
CREATE TRIGGER audit_propostas
  AFTER INSERT OR UPDATE OR DELETE ON public.propostas
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger_fn();

CREATE TRIGGER audit_proposta_itens
  AFTER INSERT OR UPDATE OR DELETE ON public.proposta_itens
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger_fn();
