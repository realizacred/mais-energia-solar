-- Cron jobs for Tuya meter readings sync
-- 1. Every 15 minutes during daytime (6h-23h BRT = 9h-2h UTC)
SELECT cron.schedule(
  'tuya-meter-sync-every-15min',
  '*/15 9-23,0-1 * * *',
  $$
    SELECT net.http_post(
      url := 'https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/tuya-proxy',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-cron-secret','cronkey2026maisenergia9X4kL7'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- 2. Daily snapshot at 23:59 BRT (02:59 UTC) — guarantees end-of-day reading
SELECT cron.schedule(
  'tuya-meter-daily-snapshot-2359',
  '59 2 * * *',
  $$
    SELECT net.http_post(
      url := 'https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/tuya-proxy',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-cron-secret','cronkey2026maisenergia9X4kL7'
      ),
      body := '{}'::jsonb
    );
  $$
);