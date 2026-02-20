
-- Add media support to internal chat messages
ALTER TABLE public.internal_chat_messages 
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_type text,
  ADD COLUMN IF NOT EXISTS media_filename text;
