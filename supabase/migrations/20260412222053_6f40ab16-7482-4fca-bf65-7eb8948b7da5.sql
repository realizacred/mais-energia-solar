-- Close current orphan run
UPDATE sm_operation_runs 
SET status = 'failed', 
    finished_at = NOW(), 
    error_summary = 'Auto-closed: orphan run (no finalize reached)'
WHERE id = 'c1e46d4b-24c4-4a05-8f03-ec230d200386' 
  AND status = 'running';

-- Reduce stale threshold from 15min to 5min for faster auto-recovery
CREATE OR REPLACE FUNCTION public.acquire_sm_operation_lock(
  p_tenant_id uuid,
  p_operation_type text,
  p_created_by uuid DEFAULT NULL,
  p_context jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_blocking_run RECORD;
  v_new_id uuid;
  v_stale_threshold timestamptz := NOW() - INTERVAL '5 minutes';
BEGIN
  -- Step 1: Auto-expire stale runs (cleanup)
  UPDATE sm_operation_runs
  SET status = 'failed',
      finished_at = NOW(),
      error_summary = 'Auto-expired: no heartbeat for 5+ minutes'
  WHERE tenant_id = p_tenant_id
    AND status IN ('queued', 'running')
    AND (
      (heartbeat_at IS NOT NULL AND heartbeat_at < v_stale_threshold)
      OR (heartbeat_at IS NULL AND started_at IS NOT NULL AND started_at < v_stale_threshold)
    );

  -- Step 2: Check for active incompatible operation
  SELECT id, operation_type, status, started_at
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
      'reason', format('Operação bloqueada: já existe %s em andamento (id=%s)', v_blocking_run.operation_type, v_blocking_run.id)
    );
  END IF;

  -- Step 3: Acquire lock by inserting a new running operation
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