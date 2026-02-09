-- Add per-instance API key (optional, falls back to global EVOLUTION_API_KEY secret)
ALTER TABLE public.wa_instances
ADD COLUMN api_key text DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.wa_instances.api_key IS 'API Key da Evolution API para esta instância. Se vazio, usa a secret global EVOLUTION_API_KEY.';