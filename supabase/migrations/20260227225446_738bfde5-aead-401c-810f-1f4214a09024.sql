
-- =====================================================
-- FASE 4 — Catálogo de Kits Solares (Template reutilizável)
-- NÃO altera proposta_kits/proposta_kit_itens (instância/snapshot)
-- =====================================================

-- 1. Tabela principal: solar_kit_catalog
CREATE TABLE public.solar_kit_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  estimated_kwp NUMERIC,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  pricing_mode TEXT NOT NULL DEFAULT 'calculated' CHECK (pricing_mode IN ('calculated', 'fixed')),
  fixed_price NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Anti-duplicação: mesmo tenant não pode ter 2 kits com mesmo nome
ALTER TABLE public.solar_kit_catalog
  ADD CONSTRAINT uq_solar_kit_catalog_tenant_name UNIQUE (tenant_id, name);

-- Índice de busca por tenant + status
CREATE INDEX idx_solar_kit_catalog_tenant_status ON public.solar_kit_catalog(tenant_id, status);

-- 2. Tabela de itens do catálogo: solar_kit_catalog_items
CREATE TABLE public.solar_kit_catalog_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  kit_id UUID NOT NULL REFERENCES public.solar_kit_catalog(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('modulo', 'inversor', 'bateria', 'generico')),
  ref_id UUID,  -- aponta para modulos_solares / inversores_catalogo / baterias (validação em código)
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  unit TEXT DEFAULT 'un',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Anti-duplicação: mesmo item (tipo+ref) não pode aparecer 2x no mesmo kit
-- Para genéricos (ref_id NULL), a description diferencia
CREATE UNIQUE INDEX uq_solar_kit_catalog_items_ref
  ON public.solar_kit_catalog_items (tenant_id, kit_id, item_type, COALESCE(ref_id::text, description));

-- Índices de performance
CREATE INDEX idx_solar_kit_catalog_items_tenant_kit ON public.solar_kit_catalog_items(tenant_id, kit_id);
CREATE INDEX idx_solar_kit_catalog_items_tenant_type ON public.solar_kit_catalog_items(tenant_id, item_type);

-- 3. Trigger de updated_at
CREATE TRIGGER update_solar_kit_catalog_updated_at
  BEFORE UPDATE ON public.solar_kit_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_solar_kit_catalog_items_updated_at
  BEFORE UPDATE ON public.solar_kit_catalog_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. RLS
ALTER TABLE public.solar_kit_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solar_kit_catalog_items ENABLE ROW LEVEL SECURITY;

-- Policies: solar_kit_catalog
CREATE POLICY "Tenant isolation SELECT" ON public.solar_kit_catalog
  FOR SELECT USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation INSERT" ON public.solar_kit_catalog
  FOR INSERT WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation UPDATE" ON public.solar_kit_catalog
  FOR UPDATE USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation DELETE" ON public.solar_kit_catalog
  FOR DELETE USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- Policies: solar_kit_catalog_items
CREATE POLICY "Tenant isolation SELECT" ON public.solar_kit_catalog_items
  FOR SELECT USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation INSERT" ON public.solar_kit_catalog_items
  FOR INSERT WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation UPDATE" ON public.solar_kit_catalog_items
  FOR UPDATE USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation DELETE" ON public.solar_kit_catalog_items
  FOR DELETE USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));
