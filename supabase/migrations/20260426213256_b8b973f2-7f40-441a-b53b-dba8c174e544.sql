-- Garante extensões para cron + http
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Agenda detector de incoerências entre funis a cada 15 minutos.
-- Idempotente: remove job antigo se existir antes de recriar.
DO $$
BEGIN
  PERFORM cron.unschedule('detect-funnel-incoherences-15m')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'detect-funnel-incoherences-15m');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'detect-funnel-incoherences-15m',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/detect-funnel-incoherences',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJndWhja3FrcG56aXlrcGJ3YmV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NzgwNzQsImV4cCI6MjA4NjA1NDA3NH0.BQAdNsi05xoWHhYJnnvmW3MIwnm8gbXTqosCTe5Ykxw"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);