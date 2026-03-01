
-- Update Growatt credential_schema to support portal mode with username+password
UPDATE integration_providers
SET credential_schema = '[
  {"key": "username", "label": "Usuário (Código)", "placeholder": "Ex: BXYV3001", "type": "text", "required": true},
  {"key": "password", "label": "Senha", "placeholder": "Sua senha do portal Growatt", "type": "password", "required": true}
]'::jsonb,
  description = 'Monitoramento via portal ShineServer (login com código de usuário e senha)',
  updated_at = now()
WHERE id = 'growatt';

-- Also add growatt_server as alias if it doesn't exist
INSERT INTO integration_providers (id, category, label, description, auth_type, credential_schema, status, popularity)
VALUES (
  'growatt_server',
  'Monitoramento Solar',
  'Growatt OSS (Portal)',
  'Monitoramento via Growatt OSS / ShineServer usando código de usuário e senha',
  'credentials',
  '[
    {"key": "username", "label": "Usuário (Código)", "placeholder": "Ex: BXYV3001", "type": "text", "required": true},
    {"key": "password", "label": "Senha", "placeholder": "Sua senha do portal Growatt", "type": "password", "required": true}
  ]'::jsonb,
  'available',
  70
)
ON CONFLICT (id) DO UPDATE SET
  credential_schema = EXCLUDED.credential_schema,
  description = EXCLUDED.description,
  updated_at = now();
