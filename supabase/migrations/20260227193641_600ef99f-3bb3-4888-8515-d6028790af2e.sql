
-- Table to store SolarMarket custom fields definitions
CREATE TABLE public.solar_market_custom_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  sm_custom_field_id INTEGER NOT NULL,
  key TEXT,
  name TEXT,
  field_type TEXT,
  options JSONB,
  raw_payload JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, sm_custom_field_id)
);

-- Table to store custom field values per project/client
CREATE TABLE public.solar_market_custom_field_values (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  sm_custom_field_id INTEGER NOT NULL,
  sm_project_id INTEGER,
  sm_client_id INTEGER,
  field_key TEXT,
  field_value TEXT,
  raw_payload JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, sm_custom_field_id, sm_project_id)
);

-- Enable RLS
ALTER TABLE public.solar_market_custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solar_market_custom_field_values ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Tenant isolation" ON public.solar_market_custom_fields
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant isolation" ON public.solar_market_custom_field_values
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

-- Indexes
CREATE INDEX idx_sm_custom_fields_tenant ON public.solar_market_custom_fields(tenant_id);
CREATE INDEX idx_sm_cf_values_tenant ON public.solar_market_custom_field_values(tenant_id);
CREATE INDEX idx_sm_cf_values_project ON public.solar_market_custom_field_values(sm_project_id);

-- Also add custom_fields JSONB column to projects for quick access
ALTER TABLE public.solar_market_projects
  ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;
