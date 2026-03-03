-- Drop the monolithic cron job
SELECT cron.unschedule('monitoring-sync-daytime');

-- Create per-provider cron jobs, staggered to avoid concurrent resource contention

-- Deye Cloud (109 plants) — minute 0,15,30,45
SELECT cron.schedule(
  'monitoring-sync-deye',
  '0,15,30,45 8-22 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/monitoring-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'cronkey2026maisenergia9X4kL7'
    ),
    body := '{"mode":"full","provider":"deye_cloud"}'::jsonb
  );
  $$
);

-- Solis Cloud (178 plants) — minute 2,17,32,47
SELECT cron.schedule(
  'monitoring-sync-solis',
  '2,17,32,47 8-22 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/monitoring-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'cronkey2026maisenergia9X4kL7'
    ),
    body := '{"mode":"full","provider":"solis_cloud"}'::jsonb
  );
  $$
);

-- Growatt (11 plants) — minute 4,19,34,49
SELECT cron.schedule(
  'monitoring-sync-growatt',
  '4,19,34,49 8-22 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/monitoring-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'cronkey2026maisenergia9X4kL7'
    ),
    body := '{"mode":"full","provider":"growatt"}'::jsonb
  );
  $$
);

-- Huawei FusionSolar (7 plants) — minute 6,21,36,51
SELECT cron.schedule(
  'monitoring-sync-huawei',
  '6,21,36,51 8-22 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/monitoring-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'cronkey2026maisenergia9X4kL7'
    ),
    body := '{"mode":"full","provider":"huawei_fusionsolar"}'::jsonb
  );
  $$
);

-- SolarEdge — minute 8,23,38,53
SELECT cron.schedule(
  'monitoring-sync-solaredge',
  '8,23,38,53 8-22 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/monitoring-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'cronkey2026maisenergia9X4kL7'
    ),
    body := '{"mode":"full","provider":"solaredge"}'::jsonb
  );
  $$
);