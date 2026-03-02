-- Remove old 24h cron and create new one: every 15min between 5h-19h BRT (8h-22h UTC)
SELECT cron.unschedule(16);

SELECT cron.schedule(
  'monitoring-sync-daytime',
  '*/15 8-22 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/monitoring-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '7fK29sLmQx9!pR8zT2vW4yA6cD'
    ),
    body := '{}'::jsonb
  );
  $$
);