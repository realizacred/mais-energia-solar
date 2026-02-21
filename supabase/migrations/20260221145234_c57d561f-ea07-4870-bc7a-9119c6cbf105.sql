-- Fix stuck run
UPDATE aneel_sync_runs 
SET status = 'timed_out', 
    finished_at = now(), 
    error_message = 'Run ficou stuck em running — finalizado manualmente (v7.0 fix origem)'
WHERE id = 'a4d93c0c-4408-421a-88e6-a71f4a7c71c8' AND status = 'running';

-- Also add 'sync_aneel' to allowed values so old references don't break, 
-- but we'll use 'sync' going forward
ALTER TABLE tarifa_versoes DROP CONSTRAINT IF EXISTS tarifa_versoes_origem_check;
ALTER TABLE tarifa_versoes ADD CONSTRAINT tarifa_versoes_origem_check 
  CHECK (origem = ANY (ARRAY['sync'::text, 'sync_aneel'::text, 'manual'::text, 'import'::text]));