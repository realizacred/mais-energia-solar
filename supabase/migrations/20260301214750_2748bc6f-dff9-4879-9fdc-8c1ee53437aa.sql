
-- Add missing unique constraint for alarm upsert
ALTER TABLE public.monitor_events
  ADD CONSTRAINT monitor_events_tenant_provider_event_uq
  UNIQUE (tenant_id, provider_event_id);

-- Fix Solis status back to connected since it was only failing on alarms
UPDATE public.monitoring_integrations
SET status = 'connected', sync_error = NULL
WHERE provider = 'solis_cloud' AND status = 'error';
