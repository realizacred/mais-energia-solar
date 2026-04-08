
-- Enum para status da ordem de compra
CREATE TYPE public.ordem_compra_status AS ENUM (
  'rascunho', 'enviada', 'confirmada', 'em_transito', 'recebida', 'cancelada'
);

-- Tabela principal: ordens_compra
CREATE TABLE public.ordens_compra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT (auth.jwt() ->> 'tenant_id')::uuid,
  projeto_id uuid REFERENCES public.projetos(id) ON DELETE SET NULL,
  fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  status ordem_compra_status NOT NULL DEFAULT 'rascunho',
  numero_pedido text,
  data_pedido date DEFAULT CURRENT_DATE,
  data_previsao_entrega date,
  data_entrega_real date,
  valor_total numeric DEFAULT 0,
  observacoes text,
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ordens_compra ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view ordens_compra"
  ON public.ordens_compra FOR SELECT TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "Tenant users can insert ordens_compra"
  ON public.ordens_compra FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "Tenant users can update ordens_compra"
  ON public.ordens_compra FOR UPDATE TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "Tenant users can delete ordens_compra"
  ON public.ordens_compra FOR DELETE TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE INDEX idx_ordens_compra_tenant ON public.ordens_compra(tenant_id);
CREATE INDEX idx_ordens_compra_projeto ON public.ordens_compra(projeto_id);
CREATE INDEX idx_ordens_compra_fornecedor ON public.ordens_compra(fornecedor_id);
CREATE INDEX idx_ordens_compra_status ON public.ordens_compra(status);

-- Trigger updated_at
CREATE TRIGGER update_ordens_compra_updated_at
  BEFORE UPDATE ON public.ordens_compra
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela: ordens_compra_itens
CREATE TABLE public.ordens_compra_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT (auth.jwt() ->> 'tenant_id')::uuid,
  ordem_compra_id uuid NOT NULL REFERENCES public.ordens_compra(id) ON DELETE CASCADE,
  estoque_item_id uuid REFERENCES public.estoque_itens(id) ON DELETE SET NULL,
  descricao text,
  quantidade numeric NOT NULL DEFAULT 1,
  unidade text DEFAULT 'un',
  valor_unitario numeric DEFAULT 0,
  valor_total numeric DEFAULT 0,
  quantidade_recebida numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ordens_compra_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view ordens_compra_itens"
  ON public.ordens_compra_itens FOR SELECT TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "Tenant users can insert ordens_compra_itens"
  ON public.ordens_compra_itens FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "Tenant users can update ordens_compra_itens"
  ON public.ordens_compra_itens FOR UPDATE TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "Tenant users can delete ordens_compra_itens"
  ON public.ordens_compra_itens FOR DELETE TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE INDEX idx_oc_itens_ordem ON public.ordens_compra_itens(ordem_compra_id);

CREATE TRIGGER update_ordens_compra_itens_updated_at
  BEFORE UPDATE ON public.ordens_compra_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela: ordens_compra_transporte
CREATE TABLE public.ordens_compra_transporte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT (auth.jwt() ->> 'tenant_id')::uuid,
  ordem_compra_id uuid NOT NULL REFERENCES public.ordens_compra(id) ON DELETE CASCADE,
  transportadora text,
  codigo_rastreio text,
  url_rastreio text,
  data_despacho date,
  previsao_chegada date,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ordens_compra_transporte ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view ordens_compra_transporte"
  ON public.ordens_compra_transporte FOR SELECT TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "Tenant users can insert ordens_compra_transporte"
  ON public.ordens_compra_transporte FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "Tenant users can update ordens_compra_transporte"
  ON public.ordens_compra_transporte FOR UPDATE TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "Tenant users can delete ordens_compra_transporte"
  ON public.ordens_compra_transporte FOR DELETE TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE INDEX idx_oc_transporte_ordem ON public.ordens_compra_transporte(ordem_compra_id);

CREATE TRIGGER update_ordens_compra_transporte_updated_at
  BEFORE UPDATE ON public.ordens_compra_transporte
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela: ordens_compra_eventos
CREATE TABLE public.ordens_compra_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT (auth.jwt() ->> 'tenant_id')::uuid,
  ordem_compra_id uuid NOT NULL REFERENCES public.ordens_compra(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'observacao',
  descricao text,
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ordens_compra_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view ordens_compra_eventos"
  ON public.ordens_compra_eventos FOR SELECT TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "Tenant users can insert ordens_compra_eventos"
  ON public.ordens_compra_eventos FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE INDEX idx_oc_eventos_ordem ON public.ordens_compra_eventos(ordem_compra_id);
