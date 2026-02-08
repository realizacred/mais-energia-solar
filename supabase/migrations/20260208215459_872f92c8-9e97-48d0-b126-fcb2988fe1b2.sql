-- Add site_url column for n8n/cron webhook configuration
ALTER TABLE public.solar_market_config
  ADD COLUMN IF NOT EXISTS site_url TEXT;

COMMENT ON COLUMN public.solar_market_config.site_url IS 'URL do site para configuração de webhooks e integrações n8n';