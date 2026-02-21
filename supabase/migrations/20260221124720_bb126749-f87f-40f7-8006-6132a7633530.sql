-- Clean up orphaned "running" sync runs that are older than 10 minutes
UPDATE aneel_sync_runs 
SET status = 'timed_out', 
    finished_at = now(), 
    error_message = 'Execução expirou (timeout automático)'
WHERE status = 'running' 
  AND started_at < now() - interval '10 minutes';