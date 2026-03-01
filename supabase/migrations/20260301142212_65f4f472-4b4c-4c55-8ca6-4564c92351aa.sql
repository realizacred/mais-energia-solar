
-- Simplify Livoltek credential schema to match actual API requirements
UPDATE integration_providers
SET credential_schema = '[
  {"key": "apiKey", "label": "Api Key (Security Key)", "type": "text", "required": true, "placeholder": "Ex: vqRCoMHt60SIhxNU7X..."},
  {"key": "appSecret", "label": "App Secret (Security ID)", "type": "password", "required": true, "placeholder": "Ex: 709f5c39a2ff..."}
]'::jsonb,
    tutorial = '{
      "steps": [
        "Acesse o portal Livoltek (livoltek-portal.com) com sua conta de distribuidor/instalador",
        "Vá em Configurações > API ou Open API Settings",
        "Copie a Api Key (Security Key) e o App Secret (Security ID)",
        "Cole as credenciais no formulário acima"
      ],
      "notes": "Apenas contas de distribuidor/instalador possuem acesso à API. Clientes finais devem solicitar ao instalador."
    }'::jsonb,
    status = 'available',
    updated_at = now()
WHERE id = 'livoltek';

UPDATE integration_providers
SET credential_schema = '[
  {"key": "apiKey", "label": "Api Key (Security Key)", "type": "text", "required": true, "placeholder": "Sua chave de API"},
  {"key": "appSecret", "label": "App Secret (Security ID)", "type": "password", "required": true, "placeholder": "Segredo da aplicação"}
]'::jsonb,
    tutorial = '{
      "steps": [
        "Acesse o portal Livoltek CloudFusion com sua conta",
        "Vá em API Settings e copie as credenciais",
        "Cole no formulário acima"
      ],
      "notes": "Contate o suporte Livoltek caso não encontre a seção de API."
    }'::jsonb,
    status = 'available',
    updated_at = now()
WHERE id = 'livoltek_cf';
