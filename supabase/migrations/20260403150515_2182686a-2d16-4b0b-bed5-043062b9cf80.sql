
DO $$
DECLARE
  wrong_tid uuid := '00000000-0000-0000-0000-000000000001';
  right_tid uuid := '17de8315-2e2f-4a79-8751-e5d507d69a41';
BEGIN
  -- 1. Fix profiles: move all users from wrong tenant to correct tenant
  UPDATE profiles SET tenant_id = right_tid WHERE tenant_id = wrong_tid;

  -- 2. Delete SM duplicates in WRONG tenant (keeping right tenant data intact)
  -- solar_market_proposals: delete wrong tenant rows (right tenant has 6, wrong has 300)
  DELETE FROM solar_market_proposals WHERE tenant_id = wrong_tid;

  -- solar_market_projects: delete wrong tenant duplicates
  DELETE FROM solar_market_projects WHERE tenant_id = wrong_tid;

  -- solar_market_clients: delete wrong tenant duplicates
  DELETE FROM solar_market_clients WHERE tenant_id = wrong_tid;

  -- solar_market_funnels: delete wrong tenant
  DELETE FROM solar_market_funnels WHERE tenant_id = wrong_tid;
  DELETE FROM solar_market_funnel_stages WHERE tenant_id = wrong_tid;

  -- solar_market_sync_logs: delete wrong tenant logs
  DELETE FROM solar_market_sync_logs WHERE tenant_id = wrong_tid;

  -- solar_market_custom_fields: delete wrong tenant
  DELETE FROM solar_market_custom_fields WHERE tenant_id = wrong_tid;

  -- solar_market_config: delete wrong tenant
  DELETE FROM solar_market_config WHERE tenant_id = wrong_tid;

  -- 3. Fix stale "running" sync logs in correct tenant
  UPDATE solar_market_sync_logs
  SET status = 'failed',
      finished_at = now(),
      total_errors = 1,
      error_message = 'Cleanup: sync travado corrigido manualmente'
  WHERE tenant_id = right_tid
    AND status = 'running';

  -- 4. Reset migrado_em on proposals so they can be re-synced cleanly
  UPDATE solar_market_proposals
  SET migrado_em = NULL
  WHERE tenant_id = right_tid;
END $$;
