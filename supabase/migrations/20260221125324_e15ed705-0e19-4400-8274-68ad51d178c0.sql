-- Clean up stuck running records
UPDATE aneel_sync_runs 
SET status = 'timed_out', 
    finished_at = now(), 
    error_message = 'Execução expirou (limpeza automática)'
WHERE status = 'running' 
  AND started_at < now() - interval '3 minutes';