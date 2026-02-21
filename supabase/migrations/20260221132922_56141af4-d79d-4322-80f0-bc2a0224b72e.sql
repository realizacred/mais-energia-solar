-- Cleanup: mark stale running runs as timed_out
UPDATE aneel_sync_runs 
SET status = 'timed_out', 
    finished_at = NOW(), 
    error_message = 'Cleanup v6.0: run antigo marcado como timeout'
WHERE status = 'running';