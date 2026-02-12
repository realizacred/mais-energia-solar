-- Add sync tracking to google_calendar_tokens
ALTER TABLE public.google_calendar_tokens
ADD COLUMN IF NOT EXISTS sync_token TEXT,
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- Create table to store Google Calendar events imported from Google
-- This is the local mirror for bidirectional awareness
CREATE TABLE IF NOT EXISTS public.google_calendar_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  google_event_id TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  description TEXT,
  location TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  status TEXT DEFAULT 'confirmed',
  html_link TEXT,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, google_event_id)
);

-- Enable RLS
ALTER TABLE public.google_calendar_events ENABLE ROW LEVEL SECURITY;

-- Users can only see their own events
CREATE POLICY "Users can view own calendar events"
ON public.google_calendar_events FOR SELECT
USING (auth.uid() = user_id);

-- Service role can manage all (for edge function sync)
CREATE POLICY "Service role manages calendar events"
ON public.google_calendar_events FOR ALL
USING (true)
WITH CHECK (true);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_gcal_events_user_start ON public.google_calendar_events (user_id, start_at DESC);
CREATE INDEX IF NOT EXISTS idx_gcal_events_google_id ON public.google_calendar_events (user_id, google_event_id);