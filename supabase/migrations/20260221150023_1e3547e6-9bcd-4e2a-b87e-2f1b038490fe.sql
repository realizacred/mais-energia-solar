-- Fix RLS policy on aneel_sync_runs: profiles.id should be profiles.user_id
DROP POLICY IF EXISTS "tenant_own_sync_runs" ON aneel_sync_runs;
CREATE POLICY "tenant_own_sync_runs" ON aneel_sync_runs
  FOR ALL
  USING (tenant_id = (SELECT p.tenant_id FROM profiles p WHERE p.user_id = auth.uid() LIMIT 1));

-- Also fix the stuck run
UPDATE aneel_sync_runs 
SET status = 'timed_out', 
    finished_at = now(), 
    error_message = 'Finalizado manualmente — isolate expirou durante FASE 2'
WHERE id = '64965954-6226-4904-93fb-f96f29b4bccc' AND status = 'running';