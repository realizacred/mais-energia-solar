-- Estoque categories with parent/child (subcategory) support
CREATE TABLE public.estoque_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  nome text NOT NULL,
  slug text NOT NULL,
  parent_id uuid REFERENCES public.estoque_categorias(id) ON DELETE CASCADE,
  ordem int DEFAULT 0,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, slug)
);

-- RLS
ALTER TABLE public.estoque_categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.estoque_categorias
  FOR ALL TO authenticated
  USING (tenant_id = (SELECT p.tenant_id FROM profiles p WHERE p.user_id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT p.tenant_id FROM profiles p WHERE p.user_id = auth.uid()));

-- Add subcategoria to estoque_itens
ALTER TABLE public.estoque_itens ADD COLUMN IF NOT EXISTS subcategoria text;

-- Recreate saldos view to include subcategoria
DROP VIEW IF EXISTS public.estoque_saldos;
CREATE OR REPLACE VIEW public.estoque_saldos AS
SELECT
  i.tenant_id,
  i.id AS item_id,
  i.nome,
  i.sku,
  i.categoria,
  i.subcategoria,
  i.unidade,
  i.custo_medio,
  i.estoque_minimo,
  i.ativo,
  i.codigo_barras,
  COALESCE(s.total, 0) AS estoque_atual,
  COALESCE(r.reservado, 0) AS reservado,
  COALESCE(s.total, 0) - COALESCE(r.reservado, 0) AS disponivel
FROM estoque_itens i
LEFT JOIN (
  SELECT item_id, SUM(quantidade * ajuste_sinal) AS total
  FROM estoque_movimentos
  GROUP BY item_id
) s ON s.item_id = i.id
LEFT JOIN (
  SELECT item_id, SUM(quantidade_reservada) AS reservado
  FROM estoque_reservas
  WHERE status = 'active'
  GROUP BY item_id
) r ON r.item_id = i.id
WHERE i.ativo = true;