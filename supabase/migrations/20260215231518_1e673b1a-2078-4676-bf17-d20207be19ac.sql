-- Clean up incomplete partial data (500 points, only covers lat -33.5 to -21.5)
-- The version 4e6c67b5 was created by an early import that timed out before completing the full Brazil grid

-- 1. Delete the 500 partial measurement points
DELETE FROM irradiance_points_monthly 
WHERE version_id = '4e6c67b5-f2ab-4762-a95b-173527ca0ba9';

-- 2. Delete the incomplete version record
DELETE FROM irradiance_dataset_versions 
WHERE id = '4e6c67b5-f2ab-4762-a95b-173527ca0ba9';

-- 3. Clear any related lookup cache
DELETE FROM irradiance_lookup_cache 
WHERE version_id = '4e6c67b5-f2ab-4762-a95b-173527ca0ba9';