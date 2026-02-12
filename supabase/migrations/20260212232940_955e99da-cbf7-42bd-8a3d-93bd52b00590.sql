
-- 1. Add source column to wa_messages to distinguish human/automation/AI messages
ALTER TABLE public.wa_messages
ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'human';

COMMENT ON COLUMN public.wa_messages.source IS 'Origin of message: human, automation, ai_suggestion, followup';

-- 2. Add temperature and max_tokens to wa_ai_settings for model configuration
ALTER TABLE public.wa_ai_settings
ADD COLUMN IF NOT EXISTS temperature numeric NOT NULL DEFAULT 0.7,
ADD COLUMN IF NOT EXISTS max_tokens integer NOT NULL DEFAULT 500,
ADD COLUMN IF NOT EXISTS followup_cooldown_hours integer NOT NULL DEFAULT 4,
ADD COLUMN IF NOT EXISTS followup_confidence_threshold integer NOT NULL DEFAULT 60;

COMMENT ON COLUMN public.wa_ai_settings.followup_cooldown_hours IS 'Min hours since last msg before allowing follow-up';
COMMENT ON COLUMN public.wa_ai_settings.followup_confidence_threshold IS 'Min confidence score (0-100) for auto-send. Below this becomes suggestion.';
