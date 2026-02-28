-- Remove the aggressive 2-minute SolarMarket cron and replace with 10-minute interval
SELECT cron.unschedule('solarmarket-auto-sync');

-- Re-create with 10-minute interval to reduce connection pool pressure
SELECT cron.schedule(
  'solarmarket-auto-sync',
  '*/10 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/solarmarket-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', '7fK29sLmQx9!pR8zT2vW4yA6cD'
      ),
      body := '{"sync_type": "auto"}'::jsonb
    );
  $$
);