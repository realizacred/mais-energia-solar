
ALTER TABLE public.wa_instances
  ADD COLUMN IF NOT EXISTS last_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_sync_messages integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_sync_conversations integer DEFAULT 0;
