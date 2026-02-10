
-- ============================================================
-- A) wa_reads: per-user read tracking
-- ============================================================
CREATE TABLE public.wa_reads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID DEFAULT get_user_tenant_id(),
  conversation_id UUID NOT NULL REFERENCES public.wa_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  last_read_message_id UUID REFERENCES public.wa_messages(id) ON DELETE SET NULL,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);

ALTER TABLE public.wa_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own wa_reads"
  ON public.wa_reads FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can upsert own wa_reads"
  ON public.wa_reads FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own wa_reads"
  ON public.wa_reads FOR UPDATE
  USING (user_id = auth.uid());

-- Index for fast lookup
CREATE INDEX idx_wa_reads_conv_user ON public.wa_reads (conversation_id, user_id);

-- ============================================================
-- B) Add last_message_id to wa_conversations
-- ============================================================
ALTER TABLE public.wa_conversations
  ADD COLUMN IF NOT EXISTS last_message_id UUID REFERENCES public.wa_messages(id) ON DELETE SET NULL;

-- ============================================================
-- C) Keyset pagination index on wa_messages
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_wa_messages_keyset
  ON public.wa_messages (conversation_id, created_at ASC, id ASC);

-- ============================================================
-- D) Drop empty legacy whatsapp_* tables
-- ============================================================
DROP TABLE IF EXISTS public.whatsapp_transfers CASCADE;
DROP TABLE IF EXISTS public.whatsapp_conversation_tags CASCADE;
DROP TABLE IF EXISTS public.whatsapp_conversation_messages CASCADE;
DROP TABLE IF EXISTS public.whatsapp_tags CASCADE;
DROP TABLE IF EXISTS public.whatsapp_conversations CASCADE;
DROP TABLE IF EXISTS public.whatsapp_messages CASCADE;
DROP TABLE IF EXISTS public.whatsapp_reminders CASCADE;

-- ============================================================
-- E) DB function for keyset pagination
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_wa_messages(
  _conversation_id UUID,
  _cursor_created_at TIMESTAMPTZ DEFAULT NULL,
  _cursor_id UUID DEFAULT NULL,
  _limit INTEGER DEFAULT 50,
  _direction TEXT DEFAULT 'older' -- 'older' or 'newer'
)
RETURNS SETOF public.wa_messages
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT *
  FROM wa_messages
  WHERE conversation_id = _conversation_id
    AND (
      _cursor_created_at IS NULL
      OR (
        CASE WHEN _direction = 'older' THEN
          (created_at, id) < (_cursor_created_at, _cursor_id)
        ELSE
          (created_at, id) > (_cursor_created_at, _cursor_id)
        END
      )
    )
  ORDER BY
    CASE WHEN _direction = 'older' THEN created_at END DESC,
    CASE WHEN _direction = 'older' THEN id END DESC,
    CASE WHEN _direction = 'newer' THEN created_at END ASC,
    CASE WHEN _direction = 'newer' THEN id END ASC
  LIMIT _limit;
$$;

-- ============================================================
-- F) Backfill last_message_id from existing data
-- ============================================================
UPDATE wa_conversations c
SET last_message_id = (
  SELECT m.id FROM wa_messages m
  WHERE m.conversation_id = c.id
  ORDER BY m.created_at DESC, m.id DESC
  LIMIT 1
)
WHERE c.last_message_id IS NULL;
