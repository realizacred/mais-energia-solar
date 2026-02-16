-- Clean up stalled NASA POWER processing version (stuck at 800 rows)
DELETE FROM irradiance_points_monthly WHERE version_id = 'c1316693-90e6-4f90-9bbc-86d884af44fd';
DELETE FROM irradiance_dataset_versions WHERE id = 'c1316693-90e6-4f90-9bbc-86d884af44fd';