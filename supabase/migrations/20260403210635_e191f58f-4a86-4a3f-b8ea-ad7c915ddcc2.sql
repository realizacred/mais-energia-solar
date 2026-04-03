-- Fix tenant_id for integration_configs google_maps (wrong tenant)
UPDATE integration_configs 
SET tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
AND service_key = 'google_maps';