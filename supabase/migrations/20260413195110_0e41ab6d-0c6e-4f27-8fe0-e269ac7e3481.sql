
CREATE OR REPLACE FUNCTION public.expire_stale_sm_operations(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired_count int;
  v_stale_threshold_active timestamptz := NOW() - INTERVAL '5 minutes';
  v_stale_threshold_idle timestamptz := NOW() - INTERVAL '2 minutes';
BEGIN
  UPDATE sm_operation_runs
  SET status = 'failed',
      finished_at = NOW(),
      error_summary = 'Auto-expired: no heartbeat (' ||
        CASE WHEN COALESCE(processed_items, 0) = 0 THEN 'idle run, 2min threshold'
             ELSE 'active run, 5min threshold' END || ')'
  WHERE tenant_id = p_tenant_id
    AND status IN ('queued', 'running')
    AND (
      (
        COALESCE(processed_items, 0) > 0
        AND (
          (heartbeat_at IS NOT NULL AND heartbeat_at < v_stale_threshold_active)
          OR (heartbeat_at IS NULL AND started_at IS NOT NULL AND started_at < v_stale_threshold_active)
        )
      )
      OR
      (
        COALESCE(processed_items, 0) = 0
        AND (
          (heartbeat_at IS NOT NULL AND heartbeat_at < v_stale_threshold_idle)
          OR (heartbeat_at IS NULL AND started_at IS NOT NULL AND started_at < v_stale_threshold_idle)
        )
      )
    );

  GET DIAGNOSTICS v_expired_count = ROW_COUNT;

  RETURN jsonb_build_object('expired_count', v_expired_count);
END;
$$;
