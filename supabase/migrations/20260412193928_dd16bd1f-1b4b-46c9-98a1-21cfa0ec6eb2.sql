-- Create a dedicated cron job for proposals sync every 5 minutes
SELECT cron.schedule(
  'solarmarket-proposals-sync',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/solarmarket-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'cronkey2026maisenergia9X4kL7'
    ),
    body := '{"sync_type": "proposals"}'::jsonb
  );
  $$
);