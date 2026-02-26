-- Add SLA pause column to wa_conversations
ALTER TABLE public.wa_conversations
ADD COLUMN IF NOT EXISTS sla_paused_until timestamptz DEFAULT NULL;

-- Add index for efficient filtering in SLA cron
CREATE INDEX IF NOT EXISTS idx_wa_conversations_sla_paused
ON public.wa_conversations (sla_paused_until)
WHERE sla_paused_until IS NOT NULL;

COMMENT ON COLUMN public.wa_conversations.sla_paused_until IS 'When set, SLA alerts are suppressed for this conversation until this timestamp. Used for manual snooze or AI-deferred alerts.';