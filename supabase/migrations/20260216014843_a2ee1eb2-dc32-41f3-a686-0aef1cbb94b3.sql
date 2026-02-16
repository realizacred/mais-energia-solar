-- Clean up stale processing version that timed out
DELETE FROM irradiance_dataset_versions 
WHERE id = 'e5378c6d-b6b8-4a3b-bcfb-a2cf6d2fd73f' 
AND status = 'processing';