-- Update Vertys integration_providers to match JNG (capabilities, tutorial)
UPDATE integration_providers
SET 
  capabilities = '{"import_kits": true, "realtime_pricing": true, "stock_availability": true}'::jsonb,
  tutorial = '{"steps": ["Acesse a plataforma HubB2B Solaryum e copie seu token de integração", "Cole o token no campo acima", "Clique em Testar Conexão para validar", "Após conectar, os kits Vertys estarão disponíveis na aba Solaryum do wizard"]}'::jsonb,
  updated_at = now()
WHERE id = 'vertys';

-- Also fix existing JNG config: clear fake fornecedor_id and re-enable
UPDATE integrations_api_configs
SET fornecedor_id = NULL, is_active = true
WHERE provider IN ('jng', 'vertys') AND fornecedor_id IS NOT NULL;