-- Drop the placeholder cron job
SELECT cron.unschedule('sm-migration-auto-resume');

-- Re-create with service_role key auth from vault
SELECT cron.schedule(
  'sm-migration-auto-resume',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/migrate-sm-proposals',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
    ),
    body := jsonb_build_object(
      '_cron_dispatch', true
    )
  ) AS request_id;
  $$
);
