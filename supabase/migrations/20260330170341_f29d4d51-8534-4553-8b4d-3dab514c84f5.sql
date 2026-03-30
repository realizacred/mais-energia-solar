-- Catalog Provider Registry — multi-provider support
CREATE TABLE IF NOT EXISTS public.catalog_provider_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider_key text NOT NULL,
  provider_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  base_url text,
  config_status text NOT NULL DEFAULT 'pending',
  capabilities jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider_key)
);

-- RLS
ALTER TABLE public.catalog_provider_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for catalog_provider_registry"
  ON public.catalog_provider_registry
  FOR ALL
  TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- Add provider_key to solar_kit_catalog if not exists (alias for source)
-- source already exists, ensure unique constraint covers multi-provider
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'solar_kit_catalog_tenant_source_external_id_key'
  ) THEN
    -- Only add if there's no existing unique constraint on these columns
    BEGIN
      ALTER TABLE public.solar_kit_catalog 
        ADD CONSTRAINT solar_kit_catalog_tenant_source_external_id_key 
        UNIQUE (tenant_id, source, external_id);
    EXCEPTION WHEN unique_violation OR duplicate_table THEN
      -- Constraint already exists or duplicate data, skip
      NULL;
    END;
  END IF;
END $$;