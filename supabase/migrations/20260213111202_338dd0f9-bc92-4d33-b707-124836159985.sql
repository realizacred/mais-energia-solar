
-- Schedule retry of failed Google Calendar syncs every 10 minutes
SELECT cron.schedule(
  'retry-failed-calendar-sync',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url:='https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/retry-failed-calendar-sync',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJndWhja3FrcG56aXlrcGJ3YmV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NzgwNzQsImV4cCI6MjA4NjA1NDA3NH0.BQAdNsi05xoWHhYJnnvmW3MIwnm8gbXTqosCTe5Ykxw"}'::jsonb,
    body:='{"source": "cron"}'::jsonb
  ) AS request_id;
  $$
);
