-- Enable extensions if not already
CREATE EXTENSION IF NOT EXISTS pg_cron SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- Schedule director weekly report: every Monday at 10:00 UTC (7:00 BRT)
SELECT cron.schedule(
  'director-weekly-report',
  '0 10 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/director-weekly-report',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJndWhja3FrcG56aXlrcGJ3YmV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NzgwNzQsImV4cCI6MjA4NjA1NDA3NH0.BQAdNsi05xoWHhYJnnvmW3MIwnm8gbXTqosCTe5Ykxw"}'::jsonb,
    body := '{"trigger": "cron"}'::jsonb
  ) AS request_id;
  $$
);