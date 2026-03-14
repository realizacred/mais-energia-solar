-- ════════════════════════════════════════════════════════
-- Payment Composition Engine — Full Schema
-- ════════════════════════════════════════════════════════

-- Enums
CREATE TYPE public.forma_pagamento_enum AS ENUM (
  'pix', 'dinheiro', 'transferencia', 'boleto',
  'cartao_credito', 'cartao_debito', 'cheque',
  'financiamento', 'crediario', 'outro'
);

CREATE TYPE public.juros_tipo_enum AS ENUM (
  'percentual', 'valor_fixo', 'sem_juros'
);

CREATE TYPE public.juros_responsavel_enum AS ENUM (
  'empresa', 'cliente', 'nao_aplica'
);

CREATE TYPE public.tipo_parcela_enum AS ENUM (
  'entrada', 'regular', 'intermediaria', 'final'
);

CREATE TYPE public.venda_status_enum AS ENUM (
  'rascunho', 'pendente', 'aprovada', 'cancelada', 'concluida'
);

CREATE TYPE public.pagamento_validacao_enum AS ENUM (
  'valido', 'divergente', 'pendente'
);

CREATE TYPE public.parcela_status_enum AS ENUM (
  'pendente', 'pago', 'atrasado', 'cancelado'
);

-- ── Table: vendas ──────────────────────────────────────
CREATE TABLE public.vendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT current_tenant_id() REFERENCES public.tenants(id),
  orcamento_id UUID REFERENCES public.leads(id),
  projeto_id UUID REFERENCES public.projetos(id),
  cliente_id UUID REFERENCES public.clientes(id),
  valor_total_bruto NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_total_liquido NUMERIC(14,2) NOT NULL DEFAULT 0,
  status public.venda_status_enum NOT NULL DEFAULT 'rascunho',
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Table: venda_pagamentos (composition header) ──────
CREATE TABLE public.venda_pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT current_tenant_id() REFERENCES public.tenants(id),
  venda_id UUID NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
  valor_total_venda NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_total_itens_base NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_total_juros NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_total_cliente NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_total_empresa_absorve NUMERIC(14,2) NOT NULL DEFAULT 0,
  status_validacao public.pagamento_validacao_enum NOT NULL DEFAULT 'pendente',
  observacoes TEXT,
  versao INT NOT NULL DEFAULT 1,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Table: venda_pagamento_itens ──────────────────────
CREATE TABLE public.venda_pagamento_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT current_tenant_id() REFERENCES public.tenants(id),
  venda_pagamento_id UUID NOT NULL REFERENCES public.venda_pagamentos(id) ON DELETE CASCADE,
  ordem INT NOT NULL DEFAULT 1,
  forma_pagamento public.forma_pagamento_enum NOT NULL,
  valor_base NUMERIC(14,2) NOT NULL DEFAULT 0,
  entrada BOOLEAN NOT NULL DEFAULT false,
  data_pagamento DATE,
  data_primeiro_vencimento DATE,
  parcelas INT DEFAULT 1,
  intervalo_dias INT DEFAULT 30,
  juros_tipo public.juros_tipo_enum NOT NULL DEFAULT 'sem_juros',
  juros_valor NUMERIC(10,4) DEFAULT 0,
  valor_juros NUMERIC(14,2) DEFAULT 0,
  valor_com_juros NUMERIC(14,2) DEFAULT 0,
  juros_responsavel public.juros_responsavel_enum NOT NULL DEFAULT 'nao_aplica',
  observacoes TEXT,
  metadata_json JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Table: venda_pagamento_parcelas ───────────────────
CREATE TABLE public.venda_pagamento_parcelas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT current_tenant_id() REFERENCES public.tenants(id),
  venda_pagamento_item_id UUID NOT NULL REFERENCES public.venda_pagamento_itens(id) ON DELETE CASCADE,
  numero_parcela INT NOT NULL,
  tipo_parcela public.tipo_parcela_enum NOT NULL DEFAULT 'regular',
  valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  vencimento DATE NOT NULL,
  status public.parcela_status_enum NOT NULL DEFAULT 'pendente',
  metadata_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────
CREATE INDEX idx_vendas_tenant ON public.vendas(tenant_id);
CREATE INDEX idx_vendas_cliente ON public.vendas(tenant_id, cliente_id);
CREATE INDEX idx_vendas_orcamento ON public.vendas(tenant_id, orcamento_id);
CREATE INDEX idx_venda_pagamentos_venda ON public.venda_pagamentos(venda_id);
CREATE INDEX idx_venda_pagamento_itens_pag ON public.venda_pagamento_itens(venda_pagamento_id);
CREATE INDEX idx_venda_pagamento_parcelas_item ON public.venda_pagamento_parcelas(venda_pagamento_item_id);
CREATE INDEX idx_venda_parcelas_status ON public.venda_pagamento_parcelas(tenant_id, status, vencimento);

-- ── updated_at triggers ───────────────────────────────
CREATE TRIGGER set_vendas_updated_at
  BEFORE UPDATE ON public.vendas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_venda_pagamentos_updated_at
  BEFORE UPDATE ON public.venda_pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_venda_pagamento_itens_updated_at
  BEFORE UPDATE ON public.venda_pagamento_itens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_venda_pagamento_parcelas_updated_at
  BEFORE UPDATE ON public.venda_pagamento_parcelas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ───────────────────────────────────────────────
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venda_pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venda_pagamento_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venda_pagamento_parcelas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendas_select" ON public.vendas FOR SELECT TO authenticated USING (tenant_id = current_tenant_id());
CREATE POLICY "vendas_insert" ON public.vendas FOR INSERT TO authenticated WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY "vendas_update" ON public.vendas FOR UPDATE TO authenticated USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY "vendas_delete" ON public.vendas FOR DELETE TO authenticated USING (tenant_id = current_tenant_id());

CREATE POLICY "venda_pagamentos_select" ON public.venda_pagamentos FOR SELECT TO authenticated USING (tenant_id = current_tenant_id());
CREATE POLICY "venda_pagamentos_insert" ON public.venda_pagamentos FOR INSERT TO authenticated WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY "venda_pagamentos_update" ON public.venda_pagamentos FOR UPDATE TO authenticated USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY "venda_pagamentos_delete" ON public.venda_pagamentos FOR DELETE TO authenticated USING (tenant_id = current_tenant_id());

CREATE POLICY "venda_pagamento_itens_select" ON public.venda_pagamento_itens FOR SELECT TO authenticated USING (tenant_id = current_tenant_id());
CREATE POLICY "venda_pagamento_itens_insert" ON public.venda_pagamento_itens FOR INSERT TO authenticated WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY "venda_pagamento_itens_update" ON public.venda_pagamento_itens FOR UPDATE TO authenticated USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY "venda_pagamento_itens_delete" ON public.venda_pagamento_itens FOR DELETE TO authenticated USING (tenant_id = current_tenant_id());

CREATE POLICY "venda_pagamento_parcelas_select" ON public.venda_pagamento_parcelas FOR SELECT TO authenticated USING (tenant_id = current_tenant_id());
CREATE POLICY "venda_pagamento_parcelas_insert" ON public.venda_pagamento_parcelas FOR INSERT TO authenticated WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY "venda_pagamento_parcelas_update" ON public.venda_pagamento_parcelas FOR UPDATE TO authenticated USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY "venda_pagamento_parcelas_delete" ON public.venda_pagamento_parcelas FOR DELETE TO authenticated USING (tenant_id = current_tenant_id());

-- ── RPC: Atomic save of payment composition ───────────
CREATE OR REPLACE FUNCTION public.save_payment_composition(
  p_venda_id UUID,
  p_observacoes TEXT DEFAULT NULL,
  p_itens JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_user_id UUID;
  v_venda RECORD;
  v_pagamento_id UUID;
  v_next_versao INT;
  v_item JSONB;
  v_item_id UUID;
  v_total_base NUMERIC(14,2) := 0;
  v_total_juros NUMERIC(14,2) := 0;
  v_total_cliente NUMERIC(14,2) := 0;
  v_total_empresa NUMERIC(14,2) := 0;
  v_parcela JSONB;
  v_item_juros NUMERIC(14,2);
  v_item_valor_com_juros NUMERIC(14,2);
  v_status_val pagamento_validacao_enum;
  v_ord INT := 0;
BEGIN
  v_user_id := auth.uid();
  v_tenant_id := current_tenant_id();

  SELECT * INTO v_venda FROM vendas WHERE id = p_venda_id AND tenant_id = v_tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda não encontrada ou acesso negado';
  END IF;

  SELECT COALESCE(MAX(versao), 0) + 1 INTO v_next_versao
  FROM venda_pagamentos WHERE venda_id = p_venda_id;

  v_pagamento_id := gen_random_uuid();

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_ord := v_ord + 1;
    v_item_id := gen_random_uuid();

    v_item_juros := 0;
    v_item_valor_com_juros := (v_item->>'valor_base')::NUMERIC;

    IF (v_item->>'juros_tipo') = 'percentual' AND COALESCE((v_item->>'juros_valor')::NUMERIC, 0) > 0 THEN
      v_item_juros := ROUND(v_item_valor_com_juros * ((v_item->>'juros_valor')::NUMERIC / 100), 2);
      v_item_valor_com_juros := v_item_valor_com_juros + v_item_juros;
    ELSIF (v_item->>'juros_tipo') = 'valor_fixo' AND COALESCE((v_item->>'juros_valor')::NUMERIC, 0) > 0 THEN
      v_item_juros := (v_item->>'juros_valor')::NUMERIC;
      v_item_valor_com_juros := v_item_valor_com_juros + v_item_juros;
    END IF;

    v_total_base := v_total_base + (v_item->>'valor_base')::NUMERIC;

    IF COALESCE(v_item->>'juros_responsavel', 'nao_aplica') = 'cliente' THEN
      v_total_juros := v_total_juros + v_item_juros;
      v_total_cliente := v_total_cliente + v_item_valor_com_juros;
    ELSIF COALESCE(v_item->>'juros_responsavel', 'nao_aplica') = 'empresa' THEN
      v_total_empresa := v_total_empresa + v_item_juros;
      v_total_cliente := v_total_cliente + (v_item->>'valor_base')::NUMERIC;
    ELSE
      v_total_cliente := v_total_cliente + (v_item->>'valor_base')::NUMERIC;
    END IF;

    INSERT INTO venda_pagamento_itens (
      id, tenant_id, venda_pagamento_id, ordem,
      forma_pagamento, valor_base, entrada,
      data_pagamento, data_primeiro_vencimento,
      parcelas, intervalo_dias,
      juros_tipo, juros_valor, valor_juros, valor_com_juros,
      juros_responsavel, observacoes, metadata_json, created_by
    ) VALUES (
      v_item_id, v_tenant_id, v_pagamento_id, v_ord,
      (v_item->>'forma_pagamento')::forma_pagamento_enum,
      (v_item->>'valor_base')::NUMERIC,
      COALESCE((v_item->>'entrada')::BOOLEAN, false),
      NULLIF(v_item->>'data_pagamento', '')::DATE,
      NULLIF(v_item->>'data_primeiro_vencimento', '')::DATE,
      COALESCE((v_item->>'parcelas')::INT, 1),
      COALESCE((v_item->>'intervalo_dias')::INT, 30),
      COALESCE((v_item->>'juros_tipo')::juros_tipo_enum, 'sem_juros'),
      COALESCE((v_item->>'juros_valor')::NUMERIC, 0),
      v_item_juros,
      v_item_valor_com_juros,
      COALESCE((v_item->>'juros_responsavel')::juros_responsavel_enum, 'nao_aplica'),
      v_item->>'observacoes',
      COALESCE((v_item->'metadata_json')::JSONB, '{}'::JSONB),
      v_user_id
    );

    IF v_item ? 'parcelas_detalhes' AND jsonb_array_length(v_item->'parcelas_detalhes') > 0 THEN
      FOR v_parcela IN SELECT * FROM jsonb_array_elements(v_item->'parcelas_detalhes')
      LOOP
        INSERT INTO venda_pagamento_parcelas (
          tenant_id, venda_pagamento_item_id,
          numero_parcela, tipo_parcela, valor, vencimento, status
        ) VALUES (
          v_tenant_id, v_item_id,
          (v_parcela->>'numero_parcela')::INT,
          COALESCE((v_parcela->>'tipo_parcela')::tipo_parcela_enum, 'regular'),
          (v_parcela->>'valor')::NUMERIC,
          (v_parcela->>'vencimento')::DATE,
          'pendente'
        );
      END LOOP;
    END IF;
  END LOOP;

  IF ABS(v_total_base - v_venda.valor_total_bruto) < 0.01 THEN
    v_status_val := 'valido';
  ELSE
    v_status_val := 'divergente';
  END IF;

  INSERT INTO venda_pagamentos (
    id, tenant_id, venda_id,
    valor_total_venda, valor_total_itens_base,
    valor_total_juros, valor_total_cliente,
    valor_total_empresa_absorve,
    status_validacao, observacoes, versao, created_by
  ) VALUES (
    v_pagamento_id, v_tenant_id, p_venda_id,
    v_venda.valor_total_bruto, v_total_base,
    v_total_juros, v_total_cliente,
    v_total_empresa,
    v_status_val, p_observacoes, v_next_versao, v_user_id
  );

  RETURN v_pagamento_id;
END;
$$;