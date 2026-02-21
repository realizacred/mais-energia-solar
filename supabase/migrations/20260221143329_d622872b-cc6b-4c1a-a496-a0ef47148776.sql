-- Fix stuck run
UPDATE aneel_sync_runs 
SET status = 'timed_out', 
    finished_at = now(), 
    error_message = 'Cleanup: run ficou em running sem finalizar (v7.0 fix)'
WHERE id = '882d078d-c08a-4aff-a3ed-d2c97b50cc03' AND status = 'running';

-- Add sync_run_id to tarifa_versoes for linking
ALTER TABLE tarifa_versoes ADD COLUMN IF NOT EXISTS sync_run_id uuid REFERENCES aneel_sync_runs(id);

-- Add index for faster lookup
CREATE INDEX IF NOT EXISTS idx_tarifa_versoes_sync_run ON tarifa_versoes(sync_run_id) WHERE sync_run_id IS NOT NULL;