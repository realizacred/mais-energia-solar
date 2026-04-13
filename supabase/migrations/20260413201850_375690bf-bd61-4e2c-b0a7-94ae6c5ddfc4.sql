-- Clean up stale running sync logs (older than 5 min without finishing)
UPDATE solar_market_sync_logs
SET status = 'failed',
    error_message = 'Timeout — sync expirou sem finalizar',
    total_errors = GREATEST(total_errors, 1),
    finished_at = NOW()
WHERE status = 'running'
  AND started_at < NOW() - INTERVAL '5 minutes';

-- Clean up stale running operation runs
UPDATE sm_operation_runs
SET status = 'failed',
    error_summary = 'Timeout — operação expirou sem finalizar',
    finished_at = NOW()
WHERE status IN ('running', 'queued')
  AND started_at < NOW() - INTERVAL '5 minutes';