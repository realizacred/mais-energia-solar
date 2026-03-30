-- Passo 1: Inserir Edeltec na tabela fornecedores (FK target)
INSERT INTO fornecedores (id, tenant_id, nome, tipo, site, categorias, observacoes)
VALUES (
  'a1b2c3d4-0001-4000-8000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Edeltec Solar',
  'distribuidor',
  'https://edeltec.com.br',
  ARRAY['kits_solares'],
  'Fornecedor integrado via API — cadastro automático'
)
ON CONFLICT (id) DO NOTHING;

-- Passo 2: Inserir JNG na tabela fornecedores
INSERT INTO fornecedores (id, tenant_id, nome, tipo, site, categorias, observacoes)
VALUES (
  'a1b2c3d4-0002-4000-8000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'JNG Solar',
  'distribuidor',
  'https://www.jngsolar.com.br',
  ARRAY['kits_solares'],
  'Fornecedor integrado via API HubB2B Solaryum — cadastro automático'
)
ON CONFLICT (id) DO NOTHING;

-- Passo 3: Inserir JNG em integration_providers (catálogo de integrações)
INSERT INTO integration_providers (
  id, category, label, description, logo_key, status, auth_type,
  credential_schema, tutorial, capabilities, platform_managed_keys, popularity
)
VALUES (
  'jng',
  'suppliers',
  'JNG Solar',
  'Sincronize o catálogo de kits solares da JNG via plataforma HubB2B Solaryum.',
  'jng',
  'available',
  'api_key',
  '[{"key":"token","label":"Token de Integração","type":"text","required":true,"placeholder":"Token fornecido pela JNG/Solaryum"}]'::jsonb,
  '{"steps":["Acesse a plataforma HubB2B Solaryum e copie seu token de integração","Cole o token no campo acima","Clique em Testar Conexão para validar","Após conectar, clique em Sincronizar para importar kits"]}'::jsonb,
  '{"import_kits":true,"stock_availability":true,"realtime_pricing":true}'::jsonb,
  false,
  40
)
ON CONFLICT (id) DO NOTHING;

-- Passo 4: Backfill fornecedor_id na integrations_api_configs da Edeltec
UPDATE integrations_api_configs
SET fornecedor_id = 'a1b2c3d4-0001-4000-8000-000000000001'::uuid
WHERE provider = 'edeltec'
  AND fornecedor_id IS NULL;

-- Passo 5: Backfill fornecedor_id nos produtos do catálogo Edeltec
UPDATE solar_kit_catalog
SET fornecedor_id = 'a1b2c3d4-0001-4000-8000-000000000001'::uuid
WHERE source = 'edeltec'
  AND fornecedor_id IS NULL;