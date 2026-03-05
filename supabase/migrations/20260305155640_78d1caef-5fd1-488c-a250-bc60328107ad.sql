INSERT INTO integration_providers (id, category, label, description, logo_key, status, auth_type, credential_schema, tutorial, capabilities, platform_managed_keys, popularity)
VALUES (
  'google_contacts',
  'crm',
  'Google Contatos',
  'Sincronização bidirecional de contatos via People API',
  'Users',
  'available',
  'oauth2',
  '[]'::jsonb,
  '{"steps": ["Acesse o Google Cloud Console e crie um projeto (ou use o mesmo do Google Agenda)", "Ative a People API no painel de APIs", "Configure a tela de consentimento OAuth com os escopos de contatos", "Crie credenciais OAuth 2.0 (Web Application)", "Adicione a URL de callback do Supabase como redirect URI autorizado", "Cole o Client ID e Client Secret aqui no sistema"], "notes": "Se você já configurou o Google Agenda, pode reutilizar o mesmo projeto e credenciais OAuth."}'::jsonb,
  '{"pull_sync": true, "push_upsert": true, "push_on_save": true}'::jsonb,
  false,
  85
)
ON CONFLICT (id) DO NOTHING;