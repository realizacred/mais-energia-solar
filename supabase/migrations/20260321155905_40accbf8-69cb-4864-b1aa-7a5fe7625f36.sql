-- Migrate existing Asaas API keys from payment_gateway_config to integration_configs
-- This is a one-time data migration to complete the secure key storage transition

INSERT INTO public.integration_configs (tenant_id, service_key, api_key, is_active, last_validated_at, updated_by)
SELECT 
  pgc.tenant_id,
  'asaas_api_key',
  pgc.api_key,
  pgc.is_active,
  now(),
  NULL
FROM public.payment_gateway_config pgc
WHERE pgc.provider = 'asaas'
  AND pgc.api_key IS NOT NULL
  AND pgc.api_key != ''
  AND length(pgc.api_key) > 5
ON CONFLICT (tenant_id, service_key) DO NOTHING;

-- Clear legacy api_key values from payment_gateway_config
UPDATE public.payment_gateway_config
SET api_key = ''
WHERE provider = 'asaas'
  AND api_key IS NOT NULL
  AND api_key != '';