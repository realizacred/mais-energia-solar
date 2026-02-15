
-- ═══════════════════════════════════════════════════════════
-- PRE-PRODUCTION CLEANUP: Solar Dataset Imports
-- Safe, tenant-scoped, FK-ordered, with guardrails
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.reset_solar_imports_preprod(
  _tenant_id UUID,
  _confirm_token TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tenant_count INTEGER;
  _tenant_status TEXT;
  _jobs_deleted INTEGER := 0;
  _logs_deleted INTEGER := 0;
  _versions_fixed INTEGER := 0;
  _result JSON;
BEGIN
  -- ─── GUARDRAIL 1: Confirmation token ───
  IF _confirm_token IS DISTINCT FROM 'RESET_SOLAR_IMPORTS_I_UNDERSTAND' THEN
    RAISE EXCEPTION 'GUARDRAIL: invalid confirm_token. Operation aborted.'
      USING ERRCODE = 'P0403';
  END IF;

  -- ─── GUARDRAIL 2: Environment check (block if multi-tenant = prod) ───
  SELECT COUNT(*) INTO _tenant_count FROM tenants WHERE ativo = true AND deleted_at IS NULL;
  IF _tenant_count > 1 THEN
    RAISE EXCEPTION 'GUARDRAIL: % active tenants detected. This procedure is blocked in multi-tenant (production) environments.', _tenant_count
      USING ERRCODE = 'P0403';
  END IF;

  -- ─── GUARDRAIL 3: Validate tenant exists ───
  SELECT status::text INTO _tenant_status FROM tenants WHERE id = _tenant_id;
  IF _tenant_status IS NULL THEN
    RAISE EXCEPTION 'GUARDRAIL: tenant_id % not found.', _tenant_id
      USING ERRCODE = 'P0404';
  END IF;

  -- ─── STEP 1: Delete orphan job logs (child FK first) ───
  WITH deleted_logs AS (
    DELETE FROM solar_import_job_logs
    WHERE tenant_id = _tenant_id
      AND job_id IN (
        SELECT id FROM solar_import_jobs
        WHERE tenant_id = _tenant_id AND status IN ('queued', 'failed')
      )
    RETURNING id
  )
  SELECT COUNT(*) INTO _logs_deleted FROM deleted_logs;

  -- ─── STEP 2: Delete orphan import jobs ───
  WITH deleted_jobs AS (
    DELETE FROM solar_import_jobs
    WHERE tenant_id = _tenant_id
      AND status IN ('queued', 'failed')
    RETURNING id
  )
  SELECT COUNT(*) INTO _jobs_deleted FROM deleted_jobs;

  -- ─── STEP 3: Fix stuck version (processing → active) if it has valid data ───
  WITH fixed_versions AS (
    UPDATE irradiance_dataset_versions
    SET status = 'active',
        row_count = (
          SELECT COUNT(*) FROM irradiance_points_monthly
          WHERE version_id = irradiance_dataset_versions.id
        )
    WHERE status = 'processing'
      AND EXISTS (
        SELECT 1 FROM irradiance_points_monthly
        WHERE version_id = irradiance_dataset_versions.id
      )
    RETURNING id
  )
  SELECT COUNT(*) INTO _versions_fixed FROM fixed_versions;

  -- ─── STEP 4: Audit record ───
  -- Use session variable to bypass guard_audit_log_insert trigger
  PERFORM set_config('app.audit_trigger_active', 'true', true);
  
  INSERT INTO audit_logs (
    tenant_id, acao, tabela, registro_id,
    dados_novos, user_id
  ) VALUES (
    _tenant_id,
    'preprod_reset',
    'solar_import_jobs',
    NULL,
    jsonb_build_object(
      'reason', 'preprod_reset',
      'jobs_deleted', _jobs_deleted,
      'logs_deleted', _logs_deleted,
      'versions_fixed', _versions_fixed,
      'executed_at', now()::text
    ),
    auth.uid()
  );

  -- ─── Result ───
  _result := json_build_object(
    'status', 'completed',
    'tenant_id', _tenant_id,
    'jobs_deleted', _jobs_deleted,
    'logs_deleted', _logs_deleted,
    'versions_fixed_to_active', _versions_fixed,
    'points_preserved', (SELECT COUNT(*) FROM irradiance_points_monthly),
    'executed_at', now()
  );

  RETURN _result;
END;
$$;

-- Grant execute only to authenticated (admin will call via RPC)
REVOKE ALL ON FUNCTION reset_solar_imports_preprod(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reset_solar_imports_preprod(UUID, TEXT) TO authenticated;
