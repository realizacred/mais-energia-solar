UPDATE solarmarket_import_jobs
SET progress_pct = 48,
    updated_at = now()
WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
  AND status IN ('running','pending');