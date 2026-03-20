-- Fix serial_number to use external_device_id (unique Tuya device ID)
UPDATE public.meter_devices SET serial_number = external_device_id WHERE provider = 'tuya';