
-- ═══════════════════════════════════════════════════════════════
-- MONITORAMENTO SOLAR UNIVERSAL — EVOLUÇÃO INCREMENTAL
-- Fases 1-4: channels, realtime, plans, alert engine support
-- ═══════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────
-- FASE 1: ALTER monitor_plants — add last_seen_at + legacy_plant_id
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.monitor_plants 
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS legacy_plant_id UUID;

CREATE INDEX IF NOT EXISTS idx_monitor_plants_legacy 
  ON public.monitor_plants(legacy_plant_id) WHERE legacy_plant_id IS NOT NULL;

-- ──────────────────────────────────────────────────────────────
-- FASE 1: ALTER monitor_events — add channel_id, fingerprint, resolved_at
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.monitor_events
  ADD COLUMN IF NOT EXISTS channel_id UUID,
  ADD COLUMN IF NOT EXISTS fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- Unique constraint for idempotent event creation
CREATE UNIQUE INDEX IF NOT EXISTS idx_monitor_events_fingerprint
  ON public.monitor_events(tenant_id, fingerprint) WHERE fingerprint IS NOT NULL AND is_open = true;

-- ──────────────────────────────────────────────────────────────
-- FASE 2: monitor_channels (canais: total/mppt/string)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.monitor_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  plant_id UUID NOT NULL REFERENCES public.monitor_plants(id) ON DELETE CASCADE,
  device_id UUID REFERENCES public.monitor_devices(id) ON DELETE SET NULL,
  name TEXT NOT NULL DEFAULT 'Total',
  channel_type TEXT NOT NULL DEFAULT 'total', -- total | mppt | string
  installed_power_wp NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.monitor_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "monitor_channels_select" ON public.monitor_channels FOR SELECT USING (tenant_id = current_tenant_id());
CREATE POLICY "monitor_channels_insert" ON public.monitor_channels FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY "monitor_channels_update" ON public.monitor_channels FOR UPDATE USING (tenant_id = current_tenant_id());
CREATE POLICY "monitor_channels_delete" ON public.monitor_channels FOR DELETE USING (tenant_id = current_tenant_id());

CREATE INDEX idx_monitor_channels_plant ON public.monitor_channels(tenant_id, plant_id);
CREATE INDEX idx_monitor_channels_device ON public.monitor_channels(tenant_id, device_id) WHERE device_id IS NOT NULL;

-- ──────────────────────────────────────────────────────────────
-- FASE 3: monitor_readings_realtime (leituras intradiárias)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.monitor_readings_realtime (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  plant_id UUID NOT NULL,
  device_id UUID,
  channel_id UUID,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  power_w NUMERIC,
  energy_kwh NUMERIC,
  voltage_v NUMERIC,
  current_a NUMERIC,
  temperature_c NUMERIC,
  status TEXT,
  metadata JSONB DEFAULT '{}',
  raw_payload_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.monitor_readings_realtime ENABLE ROW LEVEL SECURITY;

CREATE POLICY "monitor_readings_rt_select" ON public.monitor_readings_realtime FOR SELECT USING (tenant_id = current_tenant_id());
CREATE POLICY "monitor_readings_rt_insert" ON public.monitor_readings_realtime FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

-- Performance-critical indexes for alert engine queries
CREATE INDEX idx_monitor_readings_rt_plant_ts ON public.monitor_readings_realtime(tenant_id, plant_id, ts DESC);
CREATE INDEX idx_monitor_readings_rt_device_ts ON public.monitor_readings_realtime(tenant_id, device_id, ts DESC) WHERE device_id IS NOT NULL;
CREATE INDEX idx_monitor_readings_rt_channel_ts ON public.monitor_readings_realtime(tenant_id, channel_id, ts DESC) WHERE channel_id IS NOT NULL;

-- ──────────────────────────────────────────────────────────────
-- FASE 4: monitor_plans (planos de monitoramento)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.monitor_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  interval TEXT NOT NULL DEFAULT 'monthly',
  features JSONB NOT NULL DEFAULT '{}',
  max_plants INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.monitor_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "monitor_plans_public_read" ON public.monitor_plans FOR SELECT USING (true);

-- Seed plans
INSERT INTO public.monitor_plans (name, slug, price_cents, features, max_plants, display_order) VALUES
  ('Basic', 'basic', 2990, '{"alerts":["offline"],"notifications":["email"],"reports":false,"channels":false,"whatsapp":false}', 10, 1),
  ('Pro', 'pro', 7990, '{"alerts":["offline","stale_data","freeze","zero_generation","sudden_drop"],"notifications":["email","push"],"reports":true,"channels":false,"whatsapp":false}', 50, 2),
  ('Premium', 'premium', 14990, '{"alerts":["offline","stale_data","freeze","zero_generation","sudden_drop","imbalance"],"notifications":["email","push","whatsapp"],"reports":true,"channels":true,"whatsapp":true,"sla":true}', null, 3);

-- ──────────────────────────────────────────────────────────────
-- FASE 4: ALTER monitor_subscriptions — professional status machine
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.monitor_subscriptions
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.monitor_plans(id),
  ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS provider_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false;

-- Drop old status constraint if it exists and re-check is flexible
-- (status column already exists with text type — we just use convention)

-- ──────────────────────────────────────────────────────────────
-- FASE 4: ALTER monitor_billing_records — multi-gateway support
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.monitor_billing_records
  ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS provider_invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- ──────────────────────────────────────────────────────────────
-- BRIDGE FUNCTION: Populate monitor_plants from solar_plants
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bridge_solar_to_monitor_plants()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  upserted INTEGER := 0;
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT * FROM public.solar_plants WHERE integration_id IS NOT NULL
  LOOP
    INSERT INTO public.monitor_plants (
      tenant_id, name, lat, lng, city, installed_power_kwp,
      provider_id, provider_plant_id, is_active, metadata,
      legacy_plant_id, last_seen_at, created_at, updated_at
    ) VALUES (
      rec.tenant_id,
      COALESCE(rec.name, 'Usina'),
      rec.latitude, rec.longitude, rec.address,
      rec.capacity_kw,
      rec.provider, rec.external_id,
      true,
      COALESCE(rec.metadata, '{}'),
      rec.id,
      rec.updated_at,
      rec.created_at, rec.updated_at
    )
    ON CONFLICT (id) DO NOTHING;
    -- We can't ON CONFLICT on legacy_plant_id easily, so we use a subquery approach
    upserted := upserted + 1;
  END LOOP;

  -- Update existing records that match by legacy_plant_id
  UPDATE public.monitor_plants mp
  SET
    name = COALESCE(sp.name, mp.name),
    lat = COALESCE(sp.latitude, mp.lat),
    lng = COALESCE(sp.longitude, mp.lng),
    city = COALESCE(sp.address, mp.city),
    installed_power_kwp = COALESCE(sp.capacity_kw, mp.installed_power_kwp),
    provider_id = COALESCE(sp.provider, mp.provider_id),
    provider_plant_id = COALESCE(sp.external_id, mp.provider_plant_id),
    last_seen_at = sp.updated_at,
    metadata = COALESCE(sp.metadata, mp.metadata),
    updated_at = now()
  FROM public.solar_plants sp
  WHERE mp.legacy_plant_id = sp.id;

  RETURN jsonb_build_object('upserted', upserted);
END;
$$;

-- Create unique index to support upsert by legacy_plant_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_monitor_plants_legacy_unique
  ON public.monitor_plants(tenant_id, legacy_plant_id) WHERE legacy_plant_id IS NOT NULL;
