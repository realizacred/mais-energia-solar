
-- Fix Growatt credential schemas: stop suggesting datalogger serial as username
UPDATE integration_providers
SET credential_schema = '[
  {"key": "username", "type": "text", "label": "Usuário / E-mail", "required": true, "placeholder": "Seu e-mail ou login do ShinePhone"},
  {"key": "password", "type": "password", "label": "Senha", "required": true, "placeholder": "Sua senha do ShinePhone/ShineServer"}
]'::jsonb
WHERE id = 'growatt';

UPDATE integration_providers
SET credential_schema = '[
  {"key": "username", "type": "text", "label": "Usuário / E-mail", "required": true, "placeholder": "Seu e-mail ou login do ShinePhone"},
  {"key": "password", "type": "password", "label": "Senha", "required": true, "placeholder": "Sua senha do ShinePhone/ShineServer"}
]'::jsonb
WHERE id = 'growatt_server';
