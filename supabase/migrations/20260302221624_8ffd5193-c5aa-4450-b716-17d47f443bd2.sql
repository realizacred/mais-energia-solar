UPDATE tenants 
SET tenant_config = jsonb_set(COALESCE(tenant_config, '{}'), '{feature_mppt_string_monitoring}', 'true') 
WHERE id = '00000000-0000-0000-0000-000000000001';