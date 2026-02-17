-- Clean up stuck processing versions
UPDATE irradiance_dataset_versions 
SET status = 'failed', 
    metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{error}', '"Timeout — retrying with smaller chunks"'),
    updated_at = now()
WHERE status = 'processing';

-- Clean partial data from failed versions
DELETE FROM irradiance_points_monthly 
WHERE version_id IN (SELECT id FROM irradiance_dataset_versions WHERE status = 'failed');