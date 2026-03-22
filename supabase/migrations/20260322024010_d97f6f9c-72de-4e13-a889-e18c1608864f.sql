ALTER TABLE public.email_ingestion_runs
  ADD COLUMN IF NOT EXISTS error_message text;