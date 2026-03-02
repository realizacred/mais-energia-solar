-- CRON job: WA Instance Watchdog — runs every 5 minutes to auto-reconnect and sync missed messages
SELECT cron.schedule(
  'wa-instance-watchdog-every-5m',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/wa-instance-watchdog',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "7fK29sLmQx9!pR8zT2vW4yA6cD"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Also add CRON for process-wa-outbox (runs every minute to process pending sends)
-- Check if it already exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-wa-outbox-every-minute') THEN
    PERFORM cron.schedule(
      'process-wa-outbox-every-minute',
      '* * * * *',
      format('SELECT net.http_post(
        url := ''https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/process-wa-outbox'',
        headers := ''{"Content-Type": "application/json", "x-cron-secret": "7fK29sLmQx9!pR8zT2vW4yA6cD"}''::jsonb,
        body := ''{}''::jsonb
      ) AS request_id;')
    );
  END IF;
END $$;