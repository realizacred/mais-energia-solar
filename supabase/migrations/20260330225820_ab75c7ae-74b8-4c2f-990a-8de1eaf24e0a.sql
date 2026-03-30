-- Replace unique constraint on solar_kit_catalog: source → fornecedor_id
ALTER TABLE public.solar_kit_catalog
  DROP CONSTRAINT IF EXISTS solar_kit_catalog_tenant_source_external_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_solar_kit_catalog_tenant_fornecedor_external
  ON public.solar_kit_catalog (tenant_id, fornecedor_id, external_id)
  WHERE fornecedor_id IS NOT NULL AND external_id IS NOT NULL;

-- Add unique constraint on solar_kit_catalog_items for upsert
CREATE UNIQUE INDEX IF NOT EXISTS uq_solar_kit_catalog_items_dedup
  ON public.solar_kit_catalog_items (tenant_id, kit_id, item_type, ref_id)
  WHERE ref_id IS NOT NULL;

-- For items without ref_id, use a partial index
CREATE UNIQUE INDEX IF NOT EXISTS uq_solar_kit_catalog_items_dedup_null_ref
  ON public.solar_kit_catalog_items (tenant_id, kit_id, item_type)
  WHERE ref_id IS NULL;