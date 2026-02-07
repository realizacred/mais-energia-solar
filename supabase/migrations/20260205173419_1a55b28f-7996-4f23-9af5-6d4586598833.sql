-- Add Evolution API fields to whatsapp_automation_config
ALTER TABLE public.whatsapp_automation_config 
ADD COLUMN IF NOT EXISTS evolution_api_url TEXT NULL,
ADD COLUMN IF NOT EXISTS evolution_api_key TEXT NULL,
ADD COLUMN IF NOT EXISTS evolution_instance TEXT NULL,
ADD COLUMN IF NOT EXISTS modo_envio TEXT NOT NULL DEFAULT 'webhook'; -- 'webhook', 'evolution', 'ambos'