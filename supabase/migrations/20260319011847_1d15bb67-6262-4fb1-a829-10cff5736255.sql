-- Schedule reaquecimento cron job (daily at 12:00 UTC = 9:00 BRT)
SELECT cron.schedule(
  'reaquecimento-diario-9am',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url:='https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/reaquecimento-analyzer',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJndWhja3FrcG56aXlrcGJ3YmV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NzgwNzQsImV4cCI6MjA4NjA1NDA3NH0.BQAdNsi05xoWHhYJnnvmW3MIwnm8gbXTqosCTe5Ykxw"}'::jsonb,
    body:='{"cron": true}'::jsonb
  ) as request_id;
  $$
);