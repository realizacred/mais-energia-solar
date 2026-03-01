-- Create pg_cron job to sync all monitoring providers every 15 minutes
SELECT cron.schedule(
  'monitoring-sync-every-15min',
  '*/15 * * * *',
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