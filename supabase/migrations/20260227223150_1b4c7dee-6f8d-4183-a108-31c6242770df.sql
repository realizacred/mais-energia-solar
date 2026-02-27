-- Create the solarmarket auto-sync cron job using the same x-cron-secret pattern as integration-health-check
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
    );
  $$
);