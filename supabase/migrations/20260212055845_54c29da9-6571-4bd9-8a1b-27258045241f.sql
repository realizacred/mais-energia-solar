-- Add google_calendar_event_id to servicos_agendados to track synced events
ALTER TABLE public.servicos_agendados 
ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT;

-- Add google_calendar_event_id to wa_followup_queue to track synced follow-up events
ALTER TABLE public.wa_followup_queue 
ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT;

-- Add index for quick lookups
CREATE INDEX IF NOT EXISTS idx_servicos_gcal_event ON public.servicos_agendados (google_calendar_event_id) WHERE google_calendar_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_followup_gcal_event ON public.wa_followup_queue (google_calendar_event_id) WHERE google_calendar_event_id IS NOT NULL;