
-- =============================================================================
-- Formal lock acquisition for SM operations
-- Uses advisory-like pattern via sm_operation_runs with atomic check-and-insert
-- =============================================================================

-- Incompatibility matrix:
-- sync_staging / sync_proposals / sync_funnels: incompatible with each other and with migrate/reset
-- migrate_to_native: incompatible with sync and reset
-- reset_*: incompatible with everything

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
  v_stale_threshold timestamptz := NOW() - INTERVAL '15 minutes';
BEGIN
  -- Step 1: Auto-expire stale runs (cleanup)
  UPDATE sm_operation_runs
  SET status = 'failed',
      finished_at = NOW(),
      error_summary = 'Auto-expired: no heartbeat for 15+ minutes'
  WHERE tenant_id = p_tenant_id
    AND status IN ('queued', 'running')
    AND (
      (heartbeat_at IS NOT NULL AND heartbeat_at < v_stale_threshold)
      OR (heartbeat_at IS NULL AND started_at IS NOT NULL AND started_at < v_stale_threshold)
    );

  -- Step 2: Check for active incompatible operation
  -- All SM operations are mutually exclusive per tenant for safety
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

-- =============================================================================
-- Release lock (finalize operation)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.release_sm_operation_lock(
  p_run_id uuid,
  p_status text DEFAULT 'completed',
  p_total_items int DEFAULT 0,
  p_processed_items int DEFAULT 0,
  p_success_items int DEFAULT 0,
  p_error_items int DEFAULT 0,
  p_skipped_items int DEFAULT 0,
  p_error_summary text DEFAULT NULL,
  p_checkpoint jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE sm_operation_runs
  SET status = p_status,
      finished_at = NOW(),
      heartbeat_at = NOW(),
      total_items = p_total_items,
      processed_items = p_processed_items,
      success_items = p_success_items,
      error_items = p_error_items,
      skipped_items = p_skipped_items,
      error_summary = p_error_summary,
      checkpoint_json = COALESCE(p_checkpoint, checkpoint_json),
      updated_at = NOW()
  WHERE id = p_run_id;
END;
$$;

-- =============================================================================
-- Update heartbeat + checkpoint during long operations
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_sm_operation_heartbeat(
  p_run_id uuid,
  p_processed_items int DEFAULT NULL,
  p_success_items int DEFAULT NULL,
  p_error_items int DEFAULT NULL,
  p_checkpoint jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE sm_operation_runs
  SET heartbeat_at = NOW(),
      processed_items = COALESCE(p_processed_items, processed_items),
      success_items = COALESCE(p_success_items, success_items),
      error_items = COALESCE(p_error_items, error_items),
      checkpoint_json = COALESCE(p_checkpoint, checkpoint_json),
      updated_at = NOW()
  WHERE id = p_run_id
    AND status = 'running';
END;
$$;
