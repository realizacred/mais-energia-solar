-- Add is_group flag to wa_conversations
ALTER TABLE public.wa_conversations
  ADD COLUMN IF NOT EXISTS is_group boolean NOT NULL DEFAULT false;

-- Add participant_jid and participant_name to wa_messages for group context
ALTER TABLE public.wa_messages
  ADD COLUMN IF NOT EXISTS participant_jid text,
  ADD COLUMN IF NOT EXISTS participant_name text;

-- Index for filtering groups
CREATE INDEX IF NOT EXISTS idx_wa_conversations_is_group ON public.wa_conversations (is_group);
