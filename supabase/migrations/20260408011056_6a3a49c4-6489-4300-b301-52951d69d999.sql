-- Drop the OLD overload (without p_media_filename) that causes ambiguity
-- Old signature: (uuid, uuid, text, text, text, text, uuid, uuid, timestamptz, text, text)
DROP FUNCTION IF EXISTS public.enqueue_wa_outbox_item(
  uuid, uuid, text, text, text, text, uuid, uuid, timestamptz, text, text
);