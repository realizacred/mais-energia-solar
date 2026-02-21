-- Cleanup orphaned running records
UPDATE aneel_sync_runs 
SET status = 'timed_out', 
    finished_at = now(), 
    error_message = 'Cleanup v5.0: run ficou em running sem finalizar'
WHERE status = 'running';
