-- Add fornecedor_nome column for distributor traceability without FK
ALTER TABLE public.solar_kit_catalog 
  ADD COLUMN IF NOT EXISTS fornecedor_nome text;

-- Drop the partial index and recreate as unconditional for upsert support
DROP INDEX IF EXISTS uq_kit_catalog_tenant_source_extid;
CREATE UNIQUE INDEX uq_kit_catalog_tenant_source_extid 
  ON public.solar_kit_catalog (tenant_id, source, external_id);