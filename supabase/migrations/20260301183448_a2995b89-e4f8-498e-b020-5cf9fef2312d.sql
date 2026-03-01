
-- ═══════════════════════════════════════════════════════════
-- Growatt API v1 — Tables for inverter realtime data + raw events
-- ═══════════════════════════════════════════════════════════

-- Growatt inverter realtime cache (latest reading per inverter per tenant)
CREATE TABLE public.growatt_inverter_rt (
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  inverter_sn TEXT NOT NULL,
  datalogger_sn TEXT,
  ts_device TIMESTAMPTZ,
  status_text TEXT,
  status_code TEXT,
  power_w NUMERIC,
  energy_today NUMERIC,
  energy_total NUMERIC,
  temperature_c NUMERIC,
  freq_hz NUMERIC,
  pv_v1 NUMERIC, pv_i1 NUMERIC,
  pv_v2 NUMERIC, pv_i2 NUMERIC,
  pv_v3 NUMERIC, pv_i3 NUMERIC,
  raw_payload JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, inverter_sn)
);

-- Growatt raw events (append-only audit trail with deduplication)
CREATE TABLE public.growatt_raw_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  inverter_sn TEXT NOT NULL,
  ts_device TIMESTAMPTZ,
  payload_hash TEXT NOT NULL,
  raw_payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Anti-duplication index on raw events
CREATE UNIQUE INDEX idx_growatt_raw_events_dedup
  ON public.growatt_raw_events (tenant_id, inverter_sn, payload_hash);

-- Growatt integration health cache per tenant
CREATE TABLE public.growatt_health_cache (
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'unknown',
  last_ok_at TIMESTAMPTZ,
  last_fail_at TIMESTAMPTZ,
  last_error_code TEXT,
  last_http_status INTEGER,
  reason TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.growatt_inverter_rt ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growatt_raw_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growatt_health_cache ENABLE ROW LEVEL SECURITY;

-- RLS policies (tenant isolation)
CREATE POLICY "tenant_isolation" ON public.growatt_inverter_rt
  FOR ALL USING (tenant_id = public.current_tenant_id());

CREATE POLICY "tenant_isolation" ON public.growatt_raw_events
  FOR ALL USING (tenant_id = public.current_tenant_id());

CREATE POLICY "tenant_isolation" ON public.growatt_health_cache
  FOR ALL USING (tenant_id = public.current_tenant_id());

-- Growatt config per tenant (base_url + encrypted token reference)
-- Stored in monitoring_integrations with provider='growatt_v1'
-- No separate config table needed — we use the existing integration_credentials pattern.
