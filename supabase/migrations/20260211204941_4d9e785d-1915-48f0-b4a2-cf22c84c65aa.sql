
-- 1. Add missing 'role' column to solar_market_users
ALTER TABLE public.solar_market_users 
ADD COLUMN IF NOT EXISTS role text;

-- 2. Cleanup zombie sync jobs (running with no finished_at)
UPDATE public.solar_market_sync_logs
SET status = 'fail',
    finished_at = now(),
    error = 'forced-fail: zombie job cleanup (audit)'
WHERE status = 'running'
  AND finished_at IS NULL;
