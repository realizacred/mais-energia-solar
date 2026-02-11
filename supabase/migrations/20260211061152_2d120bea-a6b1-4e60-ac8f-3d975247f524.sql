
-- Add instance_id column to whatsapp_automation_logs for observability
ALTER TABLE public.whatsapp_automation_logs 
ADD COLUMN IF NOT EXISTS instance_id UUID REFERENCES public.wa_instances(id) ON DELETE SET NULL;

-- Index for fast filtering
CREATE INDEX IF NOT EXISTS idx_wa_auto_logs_instance ON public.whatsapp_automation_logs(instance_id);
