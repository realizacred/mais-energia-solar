-- Schedule pg_cron job to poll Google Calendar every 10 minutes
SELECT cron.schedule(
  'google-calendar-poll-10min',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url:='https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/google-calendar-poll',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJndWhja3FrcG56aXlrcGJ3YmV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NzgwNzQsImV4cCI6MjA4NjA1NDA3NH0.BQAdNsi05xoWHhYJnnvmW3MIwnm8gbXTqosCTe5Ykxw'
    ),
    body:='{"source": "pg_cron"}'::jsonb
  ) AS request_id;
  $$
);