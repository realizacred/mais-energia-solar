-- Schedule weekly notification for consultores (Monday 8h BRT = 11h UTC)
SELECT cron.schedule(
  'notify-consultores-weekly',
  '0 11 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/notify-consultores-weekly',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJndWhja3FrcG56aXlrcGJ3YmV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NzgwNzQsImV4cCI6MjA4NjA1NDA3NH0.BQAdNsi05xoWHhYJnnvmW3MIwnm8gbXTqosCTe5Ykxw"}'::jsonb,
    body := '{"cron": true}'::jsonb
  ) AS request_id;
  $$
);