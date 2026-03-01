
-- ============================================================
-- monitor_integration_configs — provider credentials per tenant
-- ============================================================
CREATE TABLE IF NOT EXISTS public.monitor_integration_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider_id text NOT NULL,
  display_name text,
  base_url text,
  auth jsonb NOT NULL DEFAULT '{}'::jsonb,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT false,
  last_sync_at timestamptz,
  last_events_sync_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_mic_tenant ON public.monitor_integration_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mic_provider ON public.monitor_integration_configs(provider_id);

ALTER TABLE public.monitor_integration_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mic_select_own_tenant" ON public.monitor_integration_configs
  FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY "mic_insert_own_tenant" ON public.monitor_integration_configs
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "mic_update_own_tenant" ON public.monitor_integration_configs
  FOR UPDATE USING (tenant_id = public.current_tenant_id());

CREATE POLICY "mic_delete_own_tenant" ON public.monitor_integration_configs
  FOR DELETE USING (tenant_id = public.current_tenant_id());

-- ============================================================
-- Add provider_id to monitor_health_cache if missing
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monitor_health_cache' AND column_name = 'provider_id') THEN
    ALTER TABLE public.monitor_health_cache ADD COLUMN provider_id text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monitor_health_cache' AND column_name = 'provider_plant_id') THEN
    ALTER TABLE public.monitor_health_cache ADD COLUMN provider_plant_id text;
  END IF;
END $$;

-- Add provider_id to monitor_readings_daily if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monitor_readings_daily' AND column_name = 'provider_id') THEN
    ALTER TABLE public.monitor_readings_daily ADD COLUMN provider_id text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monitor_readings_daily' AND column_name = 'provider_plant_id') THEN
    ALTER TABLE public.monitor_readings_daily ADD COLUMN provider_plant_id text;
  END IF;
END $$;

-- Add provider_id to monitor_events if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monitor_events' AND column_name = 'provider_id') THEN
    ALTER TABLE public.monitor_events ADD COLUMN provider_id text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monitor_events' AND column_name = 'provider_event_id') THEN
    ALTER TABLE public.monitor_events ADD COLUMN provider_event_id text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monitor_events' AND column_name = 'provider_plant_id') THEN
    ALTER TABLE public.monitor_events ADD COLUMN provider_plant_id text;
  END IF;
END $$;

-- Updated_at trigger for monitor_integration_configs
CREATE OR REPLACE FUNCTION public.update_monitor_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_monitor_config_updated ON public.monitor_integration_configs;
CREATE TRIGGER trg_monitor_config_updated
  BEFORE UPDATE ON public.monitor_integration_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_monitor_config_updated_at();
