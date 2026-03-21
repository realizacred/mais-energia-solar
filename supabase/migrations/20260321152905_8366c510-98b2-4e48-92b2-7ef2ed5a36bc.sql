-- Table for upsell opportunity events (dedup + tracking)
CREATE TABLE public.upsell_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  metric_key text NOT NULL,
  percentage integer NOT NULL DEFAULT 0,
  status text NOT NULL CHECK (status IN ('warning', 'blocked')),
  current_value integer NOT NULL DEFAULT 0,
  limit_value integer NOT NULL DEFAULT 0,
  notified_at timestamptz NULL,
  notification_channel text NULL, -- 'whatsapp', 'system', etc.
  resolved_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.upsell_events ENABLE ROW LEVEL SECURITY;

-- RLS: only admin/service role can read/write
CREATE POLICY "Service role full access on upsell_events"
  ON public.upsell_events
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index for dedup lookups
CREATE INDEX idx_upsell_events_tenant_metric ON public.upsell_events (tenant_id, metric_key, status);
CREATE INDEX idx_upsell_events_status ON public.upsell_events (status, resolved_at);

-- Trigger for updated_at
CREATE TRIGGER update_upsell_events_updated_at
  BEFORE UPDATE ON public.upsell_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();