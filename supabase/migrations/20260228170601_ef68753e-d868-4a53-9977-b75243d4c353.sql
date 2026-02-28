
-- ═══════════════════════════════════════════════════════════════
-- 1) Enrich solar_market_custom_fields with governance columns
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.solar_market_custom_fields
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'solarmarket',
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS version_hash text;

-- Drop old unique constraint if exists and create new composite
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'solar_market_custom_fields_tenant_source_key_uq'
  ) THEN
    ALTER TABLE public.solar_market_custom_fields
      ADD CONSTRAINT solar_market_custom_fields_tenant_source_key_uq
      UNIQUE (tenant_id, source, key);
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- 2) Add custom_fields_raw + warnings to solar_market_proposals
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.solar_market_proposals
  ADD COLUMN IF NOT EXISTS custom_fields_raw jsonb,
  ADD COLUMN IF NOT EXISTS warnings text[];

-- ═══════════════════════════════════════════════════════════════
-- 3) Snapshots table (full definition list per sync)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.solar_market_custom_fields_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  source text NOT NULL DEFAULT 'solarmarket',
  raw jsonb NOT NULL,
  snapshot_hash text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.solar_market_custom_fields_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation snapshots"
  ON public.solar_market_custom_fields_snapshots
  FOR ALL USING (tenant_id = public.current_tenant_id());

CREATE INDEX IF NOT EXISTS idx_smcf_snapshots_tenant
  ON public.solar_market_custom_fields_snapshots(tenant_id, fetched_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- 4) Custom field mappings (tenant-configurable)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.custom_field_mappings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  source_key text NOT NULL,
  target_namespace text NOT NULL DEFAULT 'metadata',
  target_path text NOT NULL DEFAULT '',
  transform text NOT NULL DEFAULT 'string',
  priority int NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT custom_field_mappings_tenant_key_uq UNIQUE (tenant_id, source_key)
);

ALTER TABLE public.custom_field_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation mappings"
  ON public.custom_field_mappings
  FOR ALL USING (tenant_id = public.current_tenant_id());

-- Trigger for updated_at
CREATE TRIGGER update_custom_field_mappings_updated_at
  BEFORE UPDATE ON public.custom_field_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
