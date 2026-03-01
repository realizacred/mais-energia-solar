
-- ═══════════════════════════════════════════════════════════
-- Billing webhook events (idempotency table for all providers)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.billing_webhook_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id),
  provider text NOT NULL, -- asaas | mercadopago | stripe
  provider_event_id text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}',
  processed_at timestamptz,
  status text NOT NULL DEFAULT 'received', -- received | processed | ignored | error
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_webhook_events_unique UNIQUE (provider, provider_event_id)
);

ALTER TABLE public.billing_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on billing_webhook_events"
  ON public.billing_webhook_events FOR ALL
  USING (true) WITH CHECK (true);

CREATE INDEX idx_billing_webhook_events_provider ON public.billing_webhook_events(provider, provider_event_id);
CREATE INDEX idx_billing_webhook_events_tenant ON public.billing_webhook_events(tenant_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════
-- Add plant_id column to monitor_subscriptions for per-plant billing
-- (currently uses plant_ids array; we need a direct FK for per-plant gating)
-- ═══════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monitor_subscriptions' AND column_name = 'plant_id') THEN
    ALTER TABLE public.monitor_subscriptions ADD COLUMN plant_id uuid REFERENCES public.solar_plants(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_monitor_subs_plant ON public.monitor_subscriptions(tenant_id, plant_id, status);

-- ═══════════════════════════════════════════════════════════
-- Add amount_cents to monitor_billing_records for multi-currency
-- ═══════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monitor_billing_records' AND column_name = 'amount_cents') THEN
    ALTER TABLE public.monitor_billing_records ADD COLUMN amount_cents integer;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- Ensure monitor_events has opened_at for guardrail (min 2 cycles)
-- ═══════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monitor_events' AND column_name = 'opened_at') THEN
    ALTER TABLE public.monitor_events ADD COLUMN opened_at timestamptz DEFAULT now();
  END IF;
END $$;
