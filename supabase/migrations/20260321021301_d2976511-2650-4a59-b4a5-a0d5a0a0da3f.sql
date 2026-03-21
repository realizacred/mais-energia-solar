-- Cron: generate AI insights daily at 9h UTC (6h BRT)
SELECT cron.schedule(
  'generate-ai-insights-daily-6h',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/generate-ai-insights',
    headers := jsonb_build_object(
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1),
      'Content-Type', 'application/json'
    ),
    body := '{"type":"daily_summary","auto":true}'::jsonb
  ) AS request_id;
  $$
);