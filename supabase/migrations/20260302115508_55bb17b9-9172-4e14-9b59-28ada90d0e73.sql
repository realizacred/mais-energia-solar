-- Remove daytime-only cron, replace with 24h continuous + 22h BRT consolidation
SELECT cron.unschedule(17);

-- Every 15 minutes, 24h
SELECT cron.schedule(
  'monitoring-sync-continuous',
  '*/15 * * * *',
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

-- Consolidation at 22h BRT = 01:00 UTC (next day)
SELECT cron.schedule(
  'monitoring-sync-consolidation',
  '0 1 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/monitoring-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '7fK29sLmQx9!pR8zT2vW4yA6cD'
    ),
    body := '{"mode":"consolidation"}'::jsonb
  );
  $$
);