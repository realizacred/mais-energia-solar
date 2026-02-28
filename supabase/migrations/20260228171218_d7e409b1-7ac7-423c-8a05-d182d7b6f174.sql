
-- Add source_provider to custom_field_mappings for multi-provider support
ALTER TABLE public.custom_field_mappings
  ADD COLUMN IF NOT EXISTS source_provider text NOT NULL DEFAULT 'solarmarket';

-- Drop old unique constraint and create new one with source_provider
ALTER TABLE public.custom_field_mappings
  DROP CONSTRAINT IF EXISTS custom_field_mappings_tenant_key_uq;

CREATE UNIQUE INDEX IF NOT EXISTS custom_field_mappings_tenant_provider_key_uq
  ON public.custom_field_mappings (tenant_id, source_provider, source_key);
