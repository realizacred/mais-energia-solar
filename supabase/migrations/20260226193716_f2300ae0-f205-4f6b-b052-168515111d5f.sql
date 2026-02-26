-- =============================================
-- INVENTORY MODULE - Ledger-based stock control
-- =============================================

-- 1. Items catalog
CREATE TABLE public.estoque_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  sku text,
  nome text NOT NULL,
  categoria text NOT NULL DEFAULT 'geral',
  unidade text NOT NULL DEFAULT 'UN',
  custo_medio numeric NOT NULL DEFAULT 0,
  estoque_minimo numeric NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.estoque_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON public.estoque_itens FOR SELECT TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.estoque_itens FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "tenant_update" ON public.estoque_itens FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "tenant_delete" ON public.estoque_itens FOR DELETE TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE INDEX idx_estoque_itens_tenant ON public.estoque_itens(tenant_id);
CREATE UNIQUE INDEX idx_estoque_itens_sku ON public.estoque_itens(tenant_id, sku) WHERE sku IS NOT NULL;

CREATE TRIGGER update_estoque_itens_updated_at
  BEFORE UPDATE ON public.estoque_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Locations
CREATE TABLE public.estoque_locais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'warehouse',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.estoque_locais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON public.estoque_locais FOR SELECT TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.estoque_locais FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "tenant_update" ON public.estoque_locais FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "tenant_delete" ON public.estoque_locais FOR DELETE TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE INDEX idx_estoque_locais_tenant ON public.estoque_locais(tenant_id);

-- 3. Movements (ledger - SSOT for stock)
CREATE TABLE public.estoque_movimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  item_id uuid NOT NULL REFERENCES public.estoque_itens(id),
  local_id uuid REFERENCES public.estoque_locais(id),
  tipo text NOT NULL CHECK (tipo IN ('entrada', 'saida', 'ajuste', 'transferencia')),
  quantidade numeric NOT NULL CHECK (quantidade > 0),
  custo_unitario numeric,
  origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('purchase', 'project', 'adjustment', 'return', 'manual')),
  ref_type text,
  ref_id uuid,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.estoque_movimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON public.estoque_movimentos FOR SELECT TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.estoque_movimentos FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE INDEX idx_estoque_movimentos_tenant ON public.estoque_movimentos(tenant_id);
CREATE INDEX idx_estoque_movimentos_item ON public.estoque_movimentos(item_id);
CREATE INDEX idx_estoque_movimentos_created ON public.estoque_movimentos(created_at DESC);

-- 4. Reservations
CREATE TABLE public.estoque_reservas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  item_id uuid NOT NULL REFERENCES public.estoque_itens(id),
  local_id uuid REFERENCES public.estoque_locais(id),
  quantidade_reservada numeric NOT NULL CHECK (quantidade_reservada > 0),
  ref_type text,
  ref_id uuid,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'consumed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.estoque_reservas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON public.estoque_reservas FOR SELECT TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.estoque_reservas FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "tenant_update" ON public.estoque_reservas FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE INDEX idx_estoque_reservas_item ON public.estoque_reservas(item_id);

-- 5. View: computed stock per item from ledger
CREATE OR REPLACE VIEW public.estoque_saldos AS
SELECT
  m.tenant_id,
  m.item_id,
  i.nome,
  i.sku,
  i.categoria,
  i.unidade,
  i.custo_medio,
  i.estoque_minimo,
  i.ativo,
  COALESCE(SUM(CASE WHEN m.tipo IN ('entrada', 'ajuste') THEN m.quantidade ELSE 0 END), 0)
  - COALESCE(SUM(CASE WHEN m.tipo = 'saida' THEN m.quantidade ELSE 0 END), 0) AS estoque_atual,
  COALESCE((SELECT SUM(r.quantidade_reservada) FROM public.estoque_reservas r WHERE r.item_id = m.item_id AND r.status = 'active'), 0) AS reservado
FROM public.estoque_movimentos m
JOIN public.estoque_itens i ON i.id = m.item_id
GROUP BY m.tenant_id, m.item_id, i.nome, i.sku, i.categoria, i.unidade, i.custo_medio, i.estoque_minimo, i.ativo;

-- RLS on view via underlying tables (views inherit RLS from base tables)

-- 6. Function to update custo_medio on entrada
CREATE OR REPLACE FUNCTION public.update_custo_medio_on_entrada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_stock numeric;
  _current_custo numeric;
  _new_custo numeric;
BEGIN
  IF NEW.tipo = 'entrada' AND NEW.custo_unitario IS NOT NULL AND NEW.custo_unitario > 0 THEN
    SELECT
      COALESCE(SUM(CASE WHEN tipo IN ('entrada', 'ajuste') THEN quantidade ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN tipo = 'saida' THEN quantidade ELSE 0 END), 0),
      COALESCE((SELECT custo_medio FROM estoque_itens WHERE id = NEW.item_id), 0)
    INTO _current_stock, _current_custo
    FROM estoque_movimentos
    WHERE item_id = NEW.item_id AND tenant_id = NEW.tenant_id;

    IF (_current_stock + NEW.quantidade) > 0 THEN
      _new_custo := ((_current_stock * _current_custo) + (NEW.quantidade * NEW.custo_unitario)) / (_current_stock + NEW.quantidade);
    ELSE
      _new_custo := NEW.custo_unitario;
    END IF;

    UPDATE estoque_itens SET custo_medio = ROUND(_new_custo, 4) WHERE id = NEW.item_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_custo_medio
  AFTER INSERT ON public.estoque_movimentos
  FOR EACH ROW EXECUTE FUNCTION public.update_custo_medio_on_entrada();