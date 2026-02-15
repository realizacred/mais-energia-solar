
-- Enable pg_cron and pg_net if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule irradiance auto-refresh every 6 months (1st day at 3am UTC)
-- Fetches INPE_2009_10KM dataset
SELECT cron.schedule(
  'irradiance-refresh-inpe2009',
  '0 3 1 */6 *',
  $$
  SELECT net.http_post(
    url := 'https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/irradiance-fetch',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJndWhja3FrcG56aXlrcGJ3YmV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NzgwNzQsImV4cCI6MjA4NjA1NDA3NH0.BQAdNsi05xoWHhYJnnvmW3MIwnm8gbXTqosCTe5Ykxw"}'::jsonb,
    body := concat('{"dataset_code":"INPE_2009_10KM","version_tag":"v', extract(year from now()), '.', lpad(extract(month from now())::text, 2, '0'), '-auto","step_deg":1}')::jsonb
  ) AS request_id;
  $$
);

-- Fetches INPE_2017_SUNDATA dataset
SELECT cron.schedule(
  'irradiance-refresh-sundata',
  '0 4 1 */6 *',
  $$
  SELECT net.http_post(
    url := 'https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/irradiance-fetch',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJndWhja3FrcG56aXlrcGJ3YmV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NzgwNzQsImV4cCI6MjA4NjA1NDA3NH0.BQAdNsi05xoWHhYJnnvmW3MIwnm8gbXTqosCTe5Ykxw"}'::jsonb,
    body := concat('{"dataset_code":"INPE_2017_SUNDATA","version_tag":"v', extract(year from now()), '.', lpad(extract(month from now())::text, 2, '0'), '-auto","step_deg":1}')::jsonb
  ) AS request_id;
  $$
);
