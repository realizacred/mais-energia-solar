-- Enable required extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron SCHEMA cron;
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- Cron 1: notify-plant-underperforming — daily at 17:00 UTC (14h BRT)
SELECT cron.schedule(
  'notify-plant-underperforming-daily',
  '0 17 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/notify-plant-underperforming',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJndWhja3FrcG56aXlrcGJ3YmV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NzgwNzQsImV4cCI6MjA4NjA1NDA3NH0.BQAdNsi05xoWHhYJnnvmW3MIwnm8gbXTqosCTe5Ykxw"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Cron 2: generate-monthly-report — 1st of month at 11:00 UTC (8h BRT)
SELECT cron.schedule(
  'generate-monthly-report-dia1',
  '0 11 1 * *',
  $$
  SELECT net.http_post(
    url := 'https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/generate-monthly-report',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJndWhja3FrcG56aXlrcGJ3YmV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NzgwNzQsImV4cCI6MjA4NjA1NDA3NH0.BQAdNsi05xoWHhYJnnvmW3MIwnm8gbXTqosCTe5Ykxw"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);