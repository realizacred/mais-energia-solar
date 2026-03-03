SELECT net.http_post(
  url := 'https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/monitoring-sync',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-cron-secret', 'cronkey2026maisenergia9X4kL7'
  ),
  body := '{"provider":"huawei_fusionsolar","mode":"full"}'::jsonb
) as request_id;