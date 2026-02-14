
-- Cache table for integration health checks
-- Written by cron edge function, read by UI
-- NOT a source of truth — just a cache of last check results

CREATE TABLE public.integration_health_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  integration_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_configured' CHECK (status IN ('healthy', 'degraded', 'down', 'not_configured')),
  latency_ms INTEGER,
  error_message TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  last_check_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, integration_name)
);

-- Index for fast tenant lookup
CREATE INDEX idx_integration_health_cache_tenant ON integration_health_cache(tenant_id);

-- Enable RLS
ALTER TABLE public.integration_health_cache ENABLE ROW LEVEL SECURITY;

-- Users can read their own tenant's health data
CREATE POLICY "Users can view own tenant health"
  ON public.integration_health_cache
  FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

-- Only service_role (edge functions) can write
-- No INSERT/UPDATE/DELETE policies for authenticated users

-- Trigger for updated_at
CREATE TRIGGER update_integration_health_cache_updated_at
  BEFORE UPDATE ON public.integration_health_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
