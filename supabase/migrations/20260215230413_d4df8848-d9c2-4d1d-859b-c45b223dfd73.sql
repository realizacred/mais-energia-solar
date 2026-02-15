
-- ═══════════════════════════════════════════════════════════
-- EXECUTE PRE-PRODUCTION CLEANUP (one-time, idempotent)
-- Tenant: 00000000-0000-0000-0000-000000000001
-- ═══════════════════════════════════════════════════════════

-- STEP 1: Delete orphan job logs (child FK)
DELETE FROM solar_import_job_logs
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND job_id IN (
    SELECT id FROM solar_import_jobs
    WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
      AND status IN ('queued', 'failed')
  );

-- STEP 2: Delete orphan import jobs
DELETE FROM solar_import_jobs
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND status IN ('queued', 'failed');

-- STEP 3: Fix stuck version → active (has 500 valid data points)
UPDATE irradiance_dataset_versions
SET status = 'active',
    row_count = 500
WHERE status = 'processing'
  AND row_count = 0
  AND id = '4e6c67b5-f2ab-4762-a95b-173527ca0ba9';

-- STEP 4: Revoke anon grant and drop cleanup function (no longer needed)
REVOKE ALL ON FUNCTION reset_solar_imports_preprod(UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION reset_solar_imports_preprod(UUID, TEXT) FROM authenticated;
DROP FUNCTION IF EXISTS reset_solar_imports_preprod(UUID, TEXT);
