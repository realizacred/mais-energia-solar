-- Drop old cron job if it exists (it referenced vault secrets incorrectly)
SELECT cron.unschedule('sm-migration-auto-resume');

-- Re-create cron job with direct URL and anon key
-- The EF itself validates x-cron-secret header
SELECT cron.schedule(
  'sm-migration-auto-resume',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/migrate-sm-proposals',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'CRON_SECRET_PLACEHOLDER'
    ),
    body := jsonb_build_object(
      'cron_mode', true
    )
  ) AS request_id;
  $$
);
