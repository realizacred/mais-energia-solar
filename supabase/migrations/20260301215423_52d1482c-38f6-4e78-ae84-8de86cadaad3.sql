
-- Update Livoltek credential_schema to include all 5 fields matching the reference UI
UPDATE public.integration_providers
SET credential_schema = '[
  {"key": "apiKey", "type": "text", "label": "Api Key (Chave Api)", "required": true, "placeholder": "Ex: vqRCoMHt60SIhxNU7X..."},
  {"key": "username", "type": "text", "label": "Usuário", "required": true, "placeholder": "Seu usuário do portal Livoltek"},
  {"key": "appSecret", "type": "password", "label": "App Secret (Segredo da Aplicação)", "required": true, "placeholder": "Ex: 709f5c39a2ff4eac93f..."},
  {"key": "password", "type": "password", "label": "Senha", "required": true, "placeholder": "Sua senha do portal Livoltek"},
  {"key": "token", "type": "password", "label": "User Token (Token do Usuário)", "required": false, "placeholder": "Opcional — será gerado automaticamente se vazio"}
]'::jsonb
WHERE id = 'livoltek';

-- Also update livoltek_cf
UPDATE public.integration_providers
SET credential_schema = '[
  {"key": "apiKey", "type": "text", "label": "Api Key (Chave Api)", "required": true, "placeholder": "Ex: vqRCoMHt60SIhxNU7X..."},
  {"key": "username", "type": "text", "label": "Usuário", "required": true, "placeholder": "Seu usuário do portal Livoltek"},
  {"key": "appSecret", "type": "password", "label": "App Secret (Segredo da Aplicação)", "required": true, "placeholder": "Ex: 709f5c39a2ff4eac93f..."},
  {"key": "password", "type": "password", "label": "Senha", "required": true, "placeholder": "Sua senha do portal Livoltek"},
  {"key": "token", "type": "password", "label": "User Token (Token do Usuário)", "required": false, "placeholder": "Opcional — será gerado automaticamente se vazio"}
]'::jsonb
WHERE id = 'livoltek_cf';
