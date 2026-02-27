
-- =====================================================
-- PATCH Fase 4 — 3 correções obrigatórias
-- =====================================================

-- (1) UNIQUE de itens mais robusto: normalizar description via lower/trim
DROP INDEX IF EXISTS public.uq_solar_kit_catalog_items_ref;
CREATE UNIQUE INDEX uq_solar_kit_catalog_items_ref
  ON public.solar_kit_catalog_items (tenant_id, kit_id, item_type, COALESCE(ref_id::text, lower(trim(description))));

-- CHECK: se item_type != 'generico', ref_id é obrigatório; se 'generico', ref_id deve ser NULL
ALTER TABLE public.solar_kit_catalog_items
  ADD CONSTRAINT chk_item_ref_consistency CHECK (
    (item_type = 'generico' AND ref_id IS NULL)
    OR (item_type <> 'generico' AND ref_id IS NOT NULL)
  );

-- (2) CHECK: fixed_price só pode ter valor quando pricing_mode = 'fixed'
ALTER TABLE public.solar_kit_catalog
  ADD CONSTRAINT chk_pricing_consistency CHECK (
    (pricing_mode = 'calculated' AND fixed_price IS NULL)
    OR (pricing_mode = 'fixed')
  );

-- (3) Trocar RLS policies para usar get_user_tenant_id() (STABLE SECURITY DEFINER)
-- solar_kit_catalog
DROP POLICY IF EXISTS "Tenant isolation SELECT" ON public.solar_kit_catalog;
DROP POLICY IF EXISTS "Tenant isolation INSERT" ON public.solar_kit_catalog;
DROP POLICY IF EXISTS "Tenant isolation UPDATE" ON public.solar_kit_catalog;
DROP POLICY IF EXISTS "Tenant isolation DELETE" ON public.solar_kit_catalog;

CREATE POLICY "Tenant isolation SELECT" ON public.solar_kit_catalog
  FOR SELECT USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant isolation INSERT" ON public.solar_kit_catalog
  FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant isolation UPDATE" ON public.solar_kit_catalog
  FOR UPDATE USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant isolation DELETE" ON public.solar_kit_catalog
  FOR DELETE USING (tenant_id = public.get_user_tenant_id());

-- solar_kit_catalog_items
DROP POLICY IF EXISTS "Tenant isolation SELECT" ON public.solar_kit_catalog_items;
DROP POLICY IF EXISTS "Tenant isolation INSERT" ON public.solar_kit_catalog_items;
DROP POLICY IF EXISTS "Tenant isolation UPDATE" ON public.solar_kit_catalog_items;
DROP POLICY IF EXISTS "Tenant isolation DELETE" ON public.solar_kit_catalog_items;

CREATE POLICY "Tenant isolation SELECT" ON public.solar_kit_catalog_items
  FOR SELECT USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant isolation INSERT" ON public.solar_kit_catalog_items
  FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant isolation UPDATE" ON public.solar_kit_catalog_items
  FOR UPDATE USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant isolation DELETE" ON public.solar_kit_catalog_items
  FOR DELETE USING (tenant_id = public.get_user_tenant_id());
