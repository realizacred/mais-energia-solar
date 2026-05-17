-- Add eos_status to analise_credito
ALTER TABLE public.analise_credito 
ADD COLUMN IF NOT EXISTS eos_status TEXT;

-- Add eos_webhook_secret to financeiras_config
ALTER TABLE public.financeiras_config 
ADD COLUMN IF NOT EXISTS eos_webhook_secret TEXT;
