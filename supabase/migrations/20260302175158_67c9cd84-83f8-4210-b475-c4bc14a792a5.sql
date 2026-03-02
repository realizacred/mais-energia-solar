
-- Remove crons antigos
SELECT cron.unschedule('monitoring-sync-continuous');
SELECT cron.unschedule('monitoring-sync-consolidation');

-- Novo cron: a cada 15 min, apenas das 08:00 às 22:00 UTC (05:00-19:00 BRT)
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
    body := '{"mode":"full"}'::jsonb
  );
  $$
);
