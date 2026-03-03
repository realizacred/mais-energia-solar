
-- Fix solarmarket-sync cron secret
SELECT cron.unschedule('solarmarket-auto-sync');
SELECT cron.schedule(
  'solarmarket-auto-sync',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/solarmarket-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'cronkey2026maisenergia9X4kL7'
    ),
    body := '{"sync_type": "auto"}'::jsonb
  );
  $$
);

-- Fix process-wa-outbox cron secret
SELECT cron.unschedule('process-wa-outbox-every-minute');
SELECT cron.schedule(
  'process-wa-outbox-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/process-wa-outbox',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'cronkey2026maisenergia9X4kL7'
    ),
    body := '{}'::jsonb
  );
  $$
);
