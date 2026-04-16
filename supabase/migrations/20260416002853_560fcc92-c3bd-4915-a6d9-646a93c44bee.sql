DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'solarmarket-auto-sync') THEN
    PERFORM cron.unschedule('solarmarket-auto-sync');
  END IF;
END $$;

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

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'solarmarket-proposals-sync') THEN
    PERFORM cron.unschedule('solarmarket-proposals-sync');
  END IF;
END $$;

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