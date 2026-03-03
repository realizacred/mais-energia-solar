-- Fix: Update all cron jobs to use a new clean CRON_SECRET without special characters
-- This avoids encoding issues with ! and other special chars in pg_net headers

-- 1. Unschedule existing jobs
SELECT cron.unschedule('integration-health-check-every-5min');
SELECT cron.unschedule('wa-instance-watchdog-every-5m');

-- 2. Reschedule with new clean secret
SELECT cron.schedule(
  'integration-health-check-every-5min',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/integration-health-check',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-cron-secret','cronkey2026maisenergia9X4kL7'
      ),
      body := '{}'::jsonb
    );
  $$
);

SELECT cron.schedule(
  'wa-instance-watchdog-every-5m',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/wa-instance-watchdog',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-cron-secret','cronkey2026maisenergia9X4kL7'
      ),
      body := '{}'::jsonb
    );
  $$
);