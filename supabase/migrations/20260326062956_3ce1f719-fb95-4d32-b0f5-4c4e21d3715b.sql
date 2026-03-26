INSERT INTO integration_providers (id, category, label, description, logo_key, status, auth_type, credential_schema, tutorial, capabilities, platform_managed_keys, popularity)
VALUES
('clicksign', 'signature', 'ClickSign', 
 'Plataforma brasileira de assinatura digital com validade jurídica, ICP-Brasil e biometria facial.',
 'clicksign', 'available', 'api_key',
 '[
   {"key": "api_token", "label": "API Token", "type": "password", "required": true, "helperText": "Encontre em Configurações → Integrações no painel ClickSign"},
   {"key": "environment", "label": "Ambiente", "type": "select", "required": true, "options": [{"value": "sandbox", "label": "Sandbox"}, {"value": "production", "label": "Produção"}]}
 ]'::jsonb,
 '{"steps": ["Acesse app.clicksign.com", "Vá em Configurações → Integrações", "Copie o API Token", "Cole aqui e selecione o ambiente"], "notes": "Use sandbox para testes iniciais"}'::jsonb,
 '{"send_document": true, "webhook": true, "biometria_facial": true, "icp_brasil": true}'::jsonb,
 false, 90),

('autentique', 'signature', 'Autentique',
 'Assinatura eletrônica simples com validade jurídica (MP 2.200). API GraphQL. Custo mais baixo do mercado.',
 'autentique', 'available', 'api_key',
 '[
   {"key": "api_token", "label": "API Token", "type": "password", "required": true, "helperText": "Encontre em Conta → Tokens de API no painel Autentique"},
   {"key": "sandbox_mode", "label": "Modo Sandbox", "type": "select", "required": true, "options": [{"value": "true", "label": "Sim"}, {"value": "false", "label": "Não"}]}
 ]'::jsonb,
 '{"steps": ["Acesse app.autentique.com.br", "Vá em Conta → Tokens de API", "Gere um novo token", "Cole aqui"], "notes": "API GraphQL — custo mais baixo do mercado"}'::jsonb,
 '{"send_document": true, "webhook": true, "biometria_facial": false, "icp_brasil": false}'::jsonb,
 false, 85),

('d4sign', 'signature', 'D4Sign',
 'Plataforma completa com ICP-Brasil, múltiplos signatários, biometria e carimbo de tempo.',
 'd4sign', 'available', 'api_key',
 '[
   {"key": "token_api", "label": "Token API", "type": "password", "required": true, "helperText": "Token da API D4Sign"},
   {"key": "crypt_key", "label": "Chave de Criptografia", "type": "password", "required": true, "helperText": "Chave de criptografia da conta D4Sign"},
   {"key": "environment", "label": "Ambiente", "type": "select", "required": true, "options": [{"value": "sandbox", "label": "Sandbox"}, {"value": "production", "label": "Produção"}]}
 ]'::jsonb,
 '{"steps": ["Acesse portal.d4sign.com.br", "Vá em Configurações → API", "Copie o Token API e a Chave de Criptografia", "Cole aqui e selecione o ambiente"], "notes": "Requer token + chave de criptografia"}'::jsonb,
 '{"send_document": true, "webhook": true, "biometria_facial": true, "icp_brasil": true, "carimbo_tempo": true}'::jsonb,
 false, 80),

('zapsign', 'signature', 'ZapSign',
 'Assinatura eletrônica com biometria facial, link de assinatura remoto e integração WhatsApp.',
 'zapsign', 'available', 'api_key',
 '[
   {"key": "api_token", "label": "API Token", "type": "password", "required": true, "helperText": "Encontre em Configurações → API Token no painel ZapSign"},
   {"key": "sandbox_mode", "label": "Modo Sandbox", "type": "select", "required": true, "options": [{"value": "true", "label": "Sim"}, {"value": "false", "label": "Não"}]}
 ]'::jsonb,
 '{"steps": ["Acesse app.zapsign.com.br", "Vá em Configurações → API Token", "Copie o token", "Cole aqui"], "notes": "Integração nativa com WhatsApp para envio de links"}'::jsonb,
 '{"send_document": true, "webhook": true, "biometria_facial": true, "icp_brasil": false, "whatsapp_native": true}'::jsonb,
 false, 88)
ON CONFLICT (id) DO NOTHING;