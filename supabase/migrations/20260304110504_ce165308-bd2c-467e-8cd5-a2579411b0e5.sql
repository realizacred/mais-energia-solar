-- Enable extensions if not already
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- Schedule meta-ads-sync every 6 hours
SELECT cron.schedule(
  'meta-ads-sync-6h',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url:='https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/meta-ads-sync',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJndWhja3FrcG56aXlrcGJ3YmV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NzgwNzQsImV4cCI6MjA4NjA1NDA3NH0.BQAdNsi05xoWHhYJnnvmW3MIwnm8gbXTqosCTe5Ykxw"}'::jsonb,
    body:='{"triggered_by": "cron"}'::jsonb
  ) AS request_id;
  $$
);