-- Add alert phone number to UC
ALTER TABLE public.units_consumidoras 
ADD COLUMN IF NOT EXISTS telefone_alertas text;

COMMENT ON COLUMN public.units_consumidoras.telefone_alertas IS 'Phone number for energy alert notifications. If null, admin phone is used.';

-- Add notification_sent_at to energy_alerts for tracking
ALTER TABLE public.energy_alerts 
ADD COLUMN IF NOT EXISTS notification_sent_at timestamptz;

COMMENT ON COLUMN public.energy_alerts.notification_sent_at IS 'When WhatsApp notification was sent for this alert.';