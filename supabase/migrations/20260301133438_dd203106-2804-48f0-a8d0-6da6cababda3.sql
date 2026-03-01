-- Add unique constraint for upsert on monitor_devices
ALTER TABLE monitor_devices
ADD CONSTRAINT monitor_devices_plant_id_provider_device_id_key
UNIQUE (plant_id, provider_device_id);

-- Fix Solis Cloud status back to connected (the error was infrastructure, not auth)
UPDATE monitoring_integrations
SET status = 'connected', sync_error = NULL
WHERE provider = 'solis_cloud' AND status = 'error';