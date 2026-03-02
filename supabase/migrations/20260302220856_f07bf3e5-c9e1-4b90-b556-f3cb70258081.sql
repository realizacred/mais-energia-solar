
-- ═══════════════════════════════════════════════════════════
-- MPPT / String Monitoring — Additive tables only
-- ═══════════════════════════════════════════════════════════

-- 1) monitor_string_registry — inventário + baseline por string/MPPT
CREATE TABLE IF NOT EXISTS public.monitor_string_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plant_id UUID NOT NULL,
  device_id UUID NOT NULL,
  inverter_serial TEXT,
  provider_id TEXT,
  mppt_number INT,
  string_number INT,
  granularity TEXT NOT NULL DEFAULT 'string' CHECK (granularity IN ('string','mppt','inverter')),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  baseline_day DATE,
  baseline_power_p50_w NUMERIC,
  baseline_power_avg_w NUMERIC,
  baseline_power_p90_w NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, plant_id, device_id, mppt_number, string_number, granularity)
);

ALTER TABLE public.monitor_string_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for monitor_string_registry"
  ON public.monitor_string_registry FOR ALL
  USING (tenant_id = (SELECT auth.jwt()->>'tenant_id')::uuid)
  WITH CHECK (tenant_id = (SELECT auth.jwt()->>'tenant_id')::uuid);

CREATE INDEX idx_msr_tenant_plant ON public.monitor_string_registry(tenant_id, plant_id);
CREATE INDEX idx_msr_device ON public.monitor_string_registry(device_id);

-- 2) monitor_string_metrics — telemetria leve por string/MPPT
CREATE TABLE IF NOT EXISTS public.monitor_string_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  registry_id UUID NOT NULL REFERENCES public.monitor_string_registry(id) ON DELETE CASCADE,
  plant_id UUID NOT NULL,
  device_id UUID NOT NULL,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  power_w NUMERIC,
  voltage_v NUMERIC,
  current_a NUMERIC,
  online BOOLEAN DEFAULT true,
  generating BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.monitor_string_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for monitor_string_metrics"
  ON public.monitor_string_metrics FOR ALL
  USING (tenant_id = (SELECT auth.jwt()->>'tenant_id')::uuid)
  WITH CHECK (tenant_id = (SELECT auth.jwt()->>'tenant_id')::uuid);

CREATE INDEX idx_msm_tenant_plant_ts ON public.monitor_string_metrics(tenant_id, plant_id, ts DESC);
CREATE INDEX idx_msm_registry_ts ON public.monitor_string_metrics(registry_id, ts DESC);
CREATE INDEX idx_msm_device_ts ON public.monitor_string_metrics(device_id, ts DESC);

-- 3) monitor_string_alerts — alertas de string/MPPT
CREATE TABLE IF NOT EXISTS public.monitor_string_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plant_id UUID NOT NULL,
  device_id UUID NOT NULL,
  registry_id UUID REFERENCES public.monitor_string_registry(id) ON DELETE SET NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('string_stopped','string_low','mppt_stopped','mppt_low')),
  severity TEXT NOT NULL DEFAULT 'warn' CHECK (severity IN ('info','warn','critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  message TEXT,
  context JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.monitor_string_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for monitor_string_alerts"
  ON public.monitor_string_alerts FOR ALL
  USING (tenant_id = (SELECT auth.jwt()->>'tenant_id')::uuid)
  WITH CHECK (tenant_id = (SELECT auth.jwt()->>'tenant_id')::uuid);

CREATE INDEX idx_msa_tenant_plant ON public.monitor_string_alerts(tenant_id, plant_id);
CREATE INDEX idx_msa_status ON public.monitor_string_alerts(status, tenant_id);
CREATE INDEX idx_msa_device ON public.monitor_string_alerts(device_id);
