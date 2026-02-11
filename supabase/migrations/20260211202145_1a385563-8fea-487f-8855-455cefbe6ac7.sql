
-- Cleanup: marca zombie jobs como 'fail'
UPDATE solar_market_sync_logs
SET
  status = 'fail',
  finished_at = now(),
  error = COALESCE(error, 'forced-fail: zombie job (no finished_at)')
WHERE status = 'running'
  AND finished_at IS NULL
  AND started_at < now() - interval '20 minutes';
