-- Add unique constraints for upsert support on monitor_devices and monitor_events

CREATE UNIQUE INDEX IF NOT EXISTS monitor_devices_tenant_provider_device
  ON public.monitor_devices (tenant_id, provider_device_id)
  WHERE provider_device_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS monitor_events_tenant_provider_event
  ON public.monitor_events (tenant_id, provider_event_id)
  WHERE provider_event_id IS NOT NULL;