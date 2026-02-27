
-- Create cron job for automatic SolarMarket sync (every 2 minutes)
-- Uses x-cron-secret header pattern consistent with other cron jobs
-- The "auto" sync_type intelligently picks proposals or projects based on what's pending
SELECT cron.schedule(
  'solarmarket-auto-sync',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/solarmarket-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '7fK29sLmQx9!pR8zT2vW4yA6cD'
    ),
    body := '{"sync_type": "auto"}'::jsonb
  ) AS request_id;
  $$
);
