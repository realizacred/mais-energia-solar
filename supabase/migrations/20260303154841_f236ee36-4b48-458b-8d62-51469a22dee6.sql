
-- Enable MPPT/String monitoring feature flag
UPDATE tenants 
SET tenant_config = COALESCE(tenant_config, '{}'::jsonb) || '{"feature_mppt_string_monitoring": true}'::jsonb
WHERE id = '17de8315-2e2f-4a79-8751-e5d507d69a41';
