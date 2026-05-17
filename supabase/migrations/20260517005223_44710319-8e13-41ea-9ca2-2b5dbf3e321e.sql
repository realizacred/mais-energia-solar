INSERT INTO public.integration_providers (
  id, 
  category, 
  label, 
  description, 
  logo_key, 
  status, 
  auth_type, 
  credential_schema, 
  tutorial, 
  capabilities, 
  platform_managed_keys, 
  popularity
) VALUES (
  'eos-financiamento-solar',
  'billing',
  'EOS Financiamento Solar',
  'Financiamento solar via plataforma EOS — simulação e envio de propostas PF e PJ.',
  'Calculator',
  'available',
  'x-api-key',
  '[]'::jsonb,
  '{"steps": ["Obtenha sua API Key no painel da EOS", "Insira a chave na página de configuração", "Ative as notificações automáticas"]}'::jsonb,
  '{"simulation": true, "proposals": true}'::jsonb,
  false,
  90
) ON CONFLICT (id) DO UPDATE SET
  category = EXCLUDED.category,
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  logo_key = EXCLUDED.logo_key,
  status = EXCLUDED.status,
  tutorial = EXCLUDED.tutorial;
