-- Mark stuck processing versions as failed (no update in 30+ minutes)
UPDATE irradiance_dataset_versions
SET status = 'failed',
    metadata = jsonb_set(
      COALESCE(metadata::jsonb, '{}'),
      '{error}',
      '"Self-chain interrompido — importação travou sem conclusão"'
    ),
    updated_at = now()
WHERE status = 'processing'
  AND updated_at < now() - interval '30 minutes';

-- Clean up orphan points from failed versions
DELETE FROM irradiance_points_monthly
WHERE version_id IN (
  SELECT id FROM irradiance_dataset_versions WHERE status = 'failed'
);

-- Reset row_count for failed versions with no points
UPDATE irradiance_dataset_versions
SET row_count = 0
WHERE status = 'failed'
  AND id NOT IN (SELECT DISTINCT version_id FROM irradiance_points_monthly);