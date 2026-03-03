
SELECT cron.unschedule('monitoring-sync-daytime');

SELECT cron.schedule(
  'monitoring-sync-daytime',
  '*/15 8-22 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/monitoring-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'cronkey2026maisenergia9X4kL7'
    ),
    body := '{"mode":"full"}'::jsonb
  );
  $$
);
