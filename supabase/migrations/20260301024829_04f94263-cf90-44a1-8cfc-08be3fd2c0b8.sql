
-- ============================================================
-- MONITOR MODULE — NEW SCHEMA (replacing solar_plants etc.)
-- ============================================================

-- 1) monitor_plants
CREATE TABLE IF NOT EXISTS public.monitor_plants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID NULL,
  name TEXT NOT NULL,
  lat NUMERIC NULL,
  lng NUMERIC NULL,
  city TEXT NULL,
  state TEXT NULL,
  installed_power_kwp NUMERIC NULL,
  provider_id TEXT NULL,
  provider_plant_id TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_monitor_plants_tenant ON public.monitor_plants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_monitor_plants_client ON public.monitor_plants(client_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_monitor_plants_provider ON public.monitor_plants(tenant_id, provider_id, provider_plant_id);

ALTER TABLE public.monitor_plants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "monitor_plants_select" ON public.monitor_plants;
CREATE POLICY "monitor_plants_select" ON public.monitor_plants FOR SELECT
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "monitor_plants_insert" ON public.monitor_plants;
CREATE POLICY "monitor_plants_insert" ON public.monitor_plants FOR INSERT
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "monitor_plants_update" ON public.monitor_plants;
CREATE POLICY "monitor_plants_update" ON public.monitor_plants FOR UPDATE
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "monitor_plants_delete" ON public.monitor_plants;
CREATE POLICY "monitor_plants_delete" ON public.monitor_plants FOR DELETE
  USING (tenant_id = public.current_tenant_id());

-- 2) monitor_devices
CREATE TABLE IF NOT EXISTS public.monitor_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plant_id UUID NOT NULL REFERENCES public.monitor_plants(id) ON DELETE CASCADE,
  provider_device_id TEXT NULL,
  type TEXT NOT NULL DEFAULT 'inverter',
  model TEXT NULL,
  serial TEXT NULL,
  last_seen_at TIMESTAMPTZ NULL,
  status TEXT NOT NULL DEFAULT 'unknown',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_monitor_devices_tenant ON public.monitor_devices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_monitor_devices_plant ON public.monitor_devices(plant_id);

ALTER TABLE public.monitor_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "monitor_devices_select" ON public.monitor_devices;
CREATE POLICY "monitor_devices_select" ON public.monitor_devices FOR SELECT
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "monitor_devices_insert" ON public.monitor_devices;
CREATE POLICY "monitor_devices_insert" ON public.monitor_devices FOR INSERT
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "monitor_devices_update" ON public.monitor_devices;
CREATE POLICY "monitor_devices_update" ON public.monitor_devices FOR UPDATE
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "monitor_devices_delete" ON public.monitor_devices;
CREATE POLICY "monitor_devices_delete" ON public.monitor_devices FOR DELETE
  USING (tenant_id = public.current_tenant_id());

-- 3) monitor_health_cache
CREATE TABLE IF NOT EXISTS public.monitor_health_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plant_id UUID NOT NULL REFERENCES public.monitor_plants(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'unknown',
  last_seen_at TIMESTAMPTZ NULL,
  energy_today_kwh NUMERIC DEFAULT 0,
  energy_month_kwh NUMERIC DEFAULT 0,
  performance_7d_pct NUMERIC NULL,
  open_alerts_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_monitor_health_cache_unique ON public.monitor_health_cache(tenant_id, plant_id);

ALTER TABLE public.monitor_health_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "monitor_health_cache_select" ON public.monitor_health_cache;
CREATE POLICY "monitor_health_cache_select" ON public.monitor_health_cache FOR SELECT
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "monitor_health_cache_insert" ON public.monitor_health_cache;
CREATE POLICY "monitor_health_cache_insert" ON public.monitor_health_cache FOR INSERT
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "monitor_health_cache_update" ON public.monitor_health_cache;
CREATE POLICY "monitor_health_cache_update" ON public.monitor_health_cache FOR UPDATE
  USING (tenant_id = public.current_tenant_id());

-- 4) monitor_events
CREATE TABLE IF NOT EXISTS public.monitor_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plant_id UUID NOT NULL REFERENCES public.monitor_plants(id) ON DELETE CASCADE,
  device_id UUID NULL REFERENCES public.monitor_devices(id) ON DELETE SET NULL,
  provider_event_id TEXT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  type TEXT NOT NULL DEFAULT 'other',
  title TEXT NOT NULL,
  message TEXT NULL,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NULL,
  is_open BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_monitor_events_tenant ON public.monitor_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_monitor_events_plant ON public.monitor_events(plant_id);
CREATE INDEX IF NOT EXISTS idx_monitor_events_open ON public.monitor_events(tenant_id, is_open);

ALTER TABLE public.monitor_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "monitor_events_select" ON public.monitor_events;
CREATE POLICY "monitor_events_select" ON public.monitor_events FOR SELECT
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "monitor_events_insert" ON public.monitor_events;
CREATE POLICY "monitor_events_insert" ON public.monitor_events FOR INSERT
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "monitor_events_update" ON public.monitor_events;
CREATE POLICY "monitor_events_update" ON public.monitor_events FOR UPDATE
  USING (tenant_id = public.current_tenant_id());

-- 5) monitor_readings_daily
CREATE TABLE IF NOT EXISTS public.monitor_readings_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plant_id UUID NOT NULL REFERENCES public.monitor_plants(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  energy_kwh NUMERIC DEFAULT 0,
  peak_power_kw NUMERIC NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_monitor_readings_daily_unique ON public.monitor_readings_daily(tenant_id, plant_id, date);
CREATE INDEX IF NOT EXISTS idx_monitor_readings_tenant ON public.monitor_readings_daily(tenant_id);

ALTER TABLE public.monitor_readings_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "monitor_readings_daily_select" ON public.monitor_readings_daily;
CREATE POLICY "monitor_readings_daily_select" ON public.monitor_readings_daily FOR SELECT
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "monitor_readings_daily_insert" ON public.monitor_readings_daily;
CREATE POLICY "monitor_readings_daily_insert" ON public.monitor_readings_daily FOR INSERT
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "monitor_readings_daily_update" ON public.monitor_readings_daily;
CREATE POLICY "monitor_readings_daily_update" ON public.monitor_readings_daily FOR UPDATE
  USING (tenant_id = public.current_tenant_id());

-- 6) monitor_provider_payloads (audit/debug)
CREATE TABLE IF NOT EXISTS public.monitor_provider_payloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NULL,
  raw JSONB NOT NULL DEFAULT '{}',
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_monitor_payloads_tenant ON public.monitor_provider_payloads(tenant_id);

ALTER TABLE public.monitor_provider_payloads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "monitor_payloads_select" ON public.monitor_provider_payloads;
CREATE POLICY "monitor_payloads_select" ON public.monitor_provider_payloads FOR SELECT
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "monitor_payloads_insert" ON public.monitor_provider_payloads;
CREATE POLICY "monitor_payloads_insert" ON public.monitor_provider_payloads FOR INSERT
  WITH CHECK (tenant_id = public.current_tenant_id());

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_monitor_plants') THEN
    CREATE TRIGGER set_updated_at_monitor_plants BEFORE UPDATE ON public.monitor_plants
      FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_monitor_devices') THEN
    CREATE TRIGGER set_updated_at_monitor_devices BEFORE UPDATE ON public.monitor_devices
      FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_monitor_events') THEN
    CREATE TRIGGER set_updated_at_monitor_events BEFORE UPDATE ON public.monitor_events
      FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_monitor_health_cache') THEN
    CREATE TRIGGER set_updated_at_monitor_health_cache BEFORE UPDATE ON public.monitor_health_cache
      FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
  END IF;
END $$;
