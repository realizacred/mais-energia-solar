
CREATE OR REPLACE FUNCTION public.acquire_sm_operation_lock(
  p_tenant_id uuid,
  p_operation_type text,
  p_created_by uuid DEFAULT NULL,
  p_context jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blocking_run RECORD;
  v_new_id uuid;
  v_stale_threshold_active timestamptz := NOW() - INTERVAL '5 minutes';
  v_stale_threshold_idle timestamptz := NOW() - INTERVAL '2 minutes';
BEGIN
  -- Step 1: Auto-expire stale runs
  -- Runs with 0 progress are considered stale after 2 min (likely crashed on boot)
  -- Runs with progress are stale after 5 min without heartbeat
  UPDATE sm_operation_runs
  SET status = 'failed',
      finished_at = NOW(),
      error_summary = 'Auto-expired: no heartbeat (' ||
        CASE WHEN COALESCE(processed_items, 0) = 0 THEN 'idle run, 2min threshold'
             ELSE 'active run, 5min threshold' END || ')'
  WHERE tenant_id = p_tenant_id
    AND status IN ('queued', 'running')
    AND (
      -- Active runs (have progress): 5 min threshold
      (
        COALESCE(processed_items, 0) > 0
        AND (
          (heartbeat_at IS NOT NULL AND heartbeat_at < v_stale_threshold_active)
          OR (heartbeat_at IS NULL AND started_at IS NOT NULL AND started_at < v_stale_threshold_active)
        )
      )
      OR
      -- Idle runs (0 progress): 2 min threshold — likely crashed on boot
      (
        COALESCE(processed_items, 0) = 0
        AND (
          (heartbeat_at IS NOT NULL AND heartbeat_at < v_stale_threshold_idle)
          OR (heartbeat_at IS NULL AND started_at IS NOT NULL AND started_at < v_stale_threshold_idle)
        )
      )
    );

  -- Step 2: Check for active incompatible operation
  SELECT id, operation_type, status, started_at, heartbeat_at,
         COALESCE(processed_items, 0) AS processed_items
  INTO v_blocking_run
  FROM sm_operation_runs
  WHERE tenant_id = p_tenant_id
    AND status IN ('queued', 'running')
  LIMIT 1;

  IF v_blocking_run.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'acquired', false,
      'run_id', null,
      'blocked_by', v_blocking_run.id,
      'blocked_by_type', v_blocking_run.operation_type,
      'blocked_by_status', v_blocking_run.status,
      'blocked_by_heartbeat', v_blocking_run.heartbeat_at,
      'blocked_by_processed', v_blocking_run.processed_items,
      'reason', format('Operação bloqueada: já existe %s em andamento (id=%s)', v_blocking_run.operation_type, v_blocking_run.id)
    );
  END IF;

  -- Step 3: Acquire lock
  INSERT INTO sm_operation_runs (
    tenant_id, source, operation_type, status,
    started_at, heartbeat_at, created_by, context_json
  ) VALUES (
    p_tenant_id, 'solar_market', p_operation_type, 'running',
    NOW(), NOW(), p_created_by, p_context
  )
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'acquired', true,
    'run_id', v_new_id
  );
END;
$$;
