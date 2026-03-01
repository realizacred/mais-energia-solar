
-- ============================================================
-- Monitoramento Solar — Tabelas + RLS + Índices
-- ============================================================

-- A) monitoring_integrations
CREATE TABLE public.monitoring_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'solarman_business',
  status text NOT NULL DEFAULT 'disconnected' CHECK (status IN ('disconnected', 'connected', 'error')),
  credentials jsonb DEFAULT '{}'::jsonb,
  tokens jsonb DEFAULT '{}'::jsonb,
  last_sync_at timestamptz,
  sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider)
);

ALTER TABLE public.monitoring_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "monitoring_integrations_tenant_isolation"
  ON public.monitoring_integrations
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE TRIGGER update_monitoring_integrations_updated_at
  BEFORE UPDATE ON public.monitoring_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- B) solar_plants
CREATE TABLE public.solar_plants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES public.monitoring_integrations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  external_id text NOT NULL,
  name text,
  capacity_kw numeric,
  address text,
  latitude numeric,
  longitude numeric,
  status text DEFAULT 'unknown' CHECK (status IN ('normal', 'offline', 'alarm', 'no_communication', 'unknown')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider, external_id)
);

ALTER TABLE public.solar_plants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "solar_plants_tenant_isolation"
  ON public.solar_plants
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE INDEX idx_solar_plants_tenant ON public.solar_plants(tenant_id);
CREATE INDEX idx_solar_plants_integration ON public.solar_plants(integration_id);

CREATE TRIGGER update_solar_plants_updated_at
  BEFORE UPDATE ON public.solar_plants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- C) solar_plant_metrics_daily
CREATE TABLE public.solar_plant_metrics_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plant_id uuid NOT NULL REFERENCES public.solar_plants(id) ON DELETE CASCADE,
  date date NOT NULL,
  energy_kwh numeric,
  power_kw numeric,
  total_energy_kwh numeric,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, plant_id, date)
);

ALTER TABLE public.solar_plant_metrics_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "solar_plant_metrics_daily_tenant_isolation"
  ON public.solar_plant_metrics_daily
  FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE INDEX idx_solar_metrics_tenant ON public.solar_plant_metrics_daily(tenant_id);
CREATE INDEX idx_solar_metrics_plant ON public.solar_plant_metrics_daily(plant_id);
CREATE INDEX idx_solar_metrics_date ON public.solar_plant_metrics_daily(date);
