-- Insert Livoltek API provider with correct 5-field credential schema
INSERT INTO integration_providers (id, category, label, description, auth_type, credential_schema, status, popularity, tutorial)
VALUES (
  'livoltek',
  'monitoring',
  'Livoltek API',
  'Monitoramento via API Livoltek com Api Key, App Secret, User Token e senha',
  'credentials',
  '[
    {"key": "apiKey", "label": "Api Key (Chave Api)", "placeholder": "Sua chave de API Livoltek", "type": "text", "required": true},
    {"key": "appSecret", "label": "App Secret (Segredo da Aplicação)", "placeholder": "Segredo da aplicação", "type": "password", "required": true},
    {"key": "username", "label": "Usuário", "placeholder": "Seu usuário do portal", "type": "text", "required": true},
    {"key": "userToken", "label": "User Token (Token do Usuário)", "placeholder": "Token de acesso do usuário", "type": "password", "required": true},
    {"key": "password", "label": "Senha", "placeholder": "Sua senha", "type": "password", "required": true}
  ]'::jsonb,
  'available',
  50,
  '{"steps": ["Acesse o portal Livoltek e vá em Configurações > API", "Copie a Api Key e o App Secret", "Gere um User Token na seção de integrações", "Cole todas as credenciais no formulário acima"], "notes": "Você precisará de acesso de administrador para gerar o token."}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  credential_schema = EXCLUDED.credential_schema,
  description = EXCLUDED.description,
  tutorial = EXCLUDED.tutorial,
  updated_at = now();

-- Also register livoltek_cf variant if needed
INSERT INTO integration_providers (id, category, label, description, auth_type, credential_schema, status, popularity, tutorial)
VALUES (
  'livoltek_cf',
  'monitoring',
  'Livoltek CF',
  'Monitoramento via portal Livoltek CloudFusion',
  'credentials',
  '[
    {"key": "apiKey", "label": "Api Key (Chave Api)", "placeholder": "Sua chave de API", "type": "text", "required": true},
    {"key": "appSecret", "label": "App Secret (Segredo da Aplicação)", "placeholder": "Segredo da aplicação", "type": "password", "required": true},
    {"key": "username", "label": "Usuário", "placeholder": "Seu usuário", "type": "text", "required": true},
    {"key": "userToken", "label": "User Token (Token do Usuário)", "placeholder": "Token do usuário", "type": "password", "required": true},
    {"key": "password", "label": "Senha", "placeholder": "Sua senha", "type": "password", "required": true}
  ]'::jsonb,
  'available',
  40,
  '{"steps": ["Acesse o portal Livoltek CloudFusion", "Vá em API Settings e copie as credenciais", "Cole no formulário acima"], "notes": "Contate o suporte Livoltek caso não encontre a seção de API."}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  credential_schema = EXCLUDED.credential_schema,
  description = EXCLUDED.description,
  tutorial = EXCLUDED.tutorial,
  updated_at = now();