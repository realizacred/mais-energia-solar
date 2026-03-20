
-- Junction table: plant ↔ data sources (portais/inversores)
-- Supports N:N relationship between plants and monitoring credentials
CREATE TABLE public.plant_data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id UUID NOT NULL REFERENCES public.monitor_plants(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES public.monitoring_integrations(id) ON DELETE CASCADE,
  provider_device_id TEXT, -- optional: specific inverter/device from this credential
  label TEXT, -- display label e.g. "solarz3 - solarz3_9976_2"
  is_active BOOLEAN NOT NULL DEFAULT true,
  tenant_id UUID NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(plant_id, integration_id, provider_device_id)
);

ALTER TABLE public.plant_data_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation select" ON public.plant_data_sources
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT current_tenant_id()));

CREATE POLICY "Tenant isolation insert" ON public.plant_data_sources
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT current_tenant_id()));

CREATE POLICY "Tenant isolation update" ON public.plant_data_sources
  FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT current_tenant_id()));

CREATE POLICY "Tenant isolation delete" ON public.plant_data_sources
  FOR DELETE TO authenticated
  USING (tenant_id = (SELECT current_tenant_id()));

CREATE INDEX idx_plant_data_sources_plant_id ON public.plant_data_sources(plant_id);
CREATE INDEX idx_plant_data_sources_integration_id ON public.plant_data_sources(integration_id);
CREATE INDEX idx_plant_data_sources_tenant_id ON public.plant_data_sources(tenant_id);

CREATE TRIGGER update_plant_data_sources_updated_at
  BEFORE UPDATE ON public.plant_data_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
