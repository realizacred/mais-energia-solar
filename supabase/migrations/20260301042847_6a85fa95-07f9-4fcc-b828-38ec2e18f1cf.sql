UPDATE integration_providers 
SET credential_schema = '[
  {"key": "region", "label": "Região / Data Center", "type": "select", "required": true, "options": [
    {"value": "EU", "label": "Europa (EU)"},
    {"value": "US", "label": "Estados Unidos (US)"},
    {"value": "AMEA", "label": "AMEA (Americas/MEA)"},
    {"value": "INDIA", "label": "Índia"}
  ]},
  {"key": "appId", "label": "ID do Aplicativo (App ID)", "type": "text", "required": true},
  {"key": "appSecret", "label": "Segredo do Aplicativo (App Secret)", "type": "password", "required": true},
  {"key": "email", "label": "E-mail da conta Deye Cloud", "type": "text", "required": true},
  {"key": "password", "label": "Senha da conta Deye Cloud", "type": "password", "required": true}
]'::jsonb
WHERE id = 'deye_cloud';