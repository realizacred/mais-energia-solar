
-- ============================================================
-- HARDENING: Cache derivado last_message_direction
-- Source of Truth permanece: wa_messages.direction
-- Objetivo: evitar N+1 queries no frontend da Inbox
-- Rollback: ALTER TABLE public.wa_conversations DROP COLUMN last_message_direction;
-- ============================================================

-- A) Adicionar coluna (nullable, sem default agressivo)
ALTER TABLE public.wa_conversations
ADD COLUMN IF NOT EXISTS last_message_direction text;

-- B) Check constraint para integridade
ALTER TABLE public.wa_conversations
ADD CONSTRAINT chk_last_message_direction
CHECK (last_message_direction IN ('in', 'out') OR last_message_direction IS NULL);

-- C) Documentação inline
COMMENT ON COLUMN public.wa_conversations.last_message_direction IS
'Cache derivado de wa_messages.direction para evitar N+1 na Inbox. Source of Truth permanece wa_messages.';

-- D) Backfill idempotente (uma única query, sem loop, sem N+1)
WITH last_msg AS (
  SELECT DISTINCT ON (m.conversation_id)
    m.conversation_id,
    m.direction
  FROM public.wa_messages m
  WHERE m.is_internal_note = false
  ORDER BY m.conversation_id, m.created_at DESC
)
UPDATE public.wa_conversations c
SET last_message_direction = lm.direction
FROM last_msg lm
WHERE c.id = lm.conversation_id
  AND c.last_message_direction IS NULL;
