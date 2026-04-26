ALTER TABLE public.wa_instances ADD COLUMN IF NOT EXISTS api_flavor TEXT NOT NULL DEFAULT 'classic' CHECK (api_flavor IN ('classic','go'));
COMMENT ON COLUMN public.wa_instances.api_flavor IS 'classic = Evolution API (Baileys); go = Evolution GO (whatsmeow)';
CREATE INDEX IF NOT EXISTS idx_wa_instances_api_flavor ON public.wa_instances(api_flavor);