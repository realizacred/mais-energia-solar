-- Add settings jsonb column to vendedores for per-vendor preferences
-- (toggle auto-message, custom template, etc.)
ALTER TABLE public.vendedores
ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}';

-- Comment for documentation
COMMENT ON COLUMN public.vendedores.settings IS 'Per-vendor settings/preferences (wa_auto_message_enabled, wa_auto_message_template, etc.)';