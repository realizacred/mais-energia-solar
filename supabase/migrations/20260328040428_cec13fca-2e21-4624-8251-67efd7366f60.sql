
-- Migration: Add external source fields to solar_kit_catalog
ALTER TABLE solar_kit_catalog
  ADD COLUMN IF NOT EXISTS fornecedor_id UUID REFERENCES fornecedores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS external_data JSONB;

-- Indexes for external lookups
CREATE INDEX IF NOT EXISTS idx_kit_catalog_external_id
  ON solar_kit_catalog(external_id) WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kit_catalog_fornecedor
  ON solar_kit_catalog(fornecedor_id) WHERE fornecedor_id IS NOT NULL;

-- Add fornecedor_id to integrations_api_configs
ALTER TABLE integrations_api_configs
  ADD COLUMN IF NOT EXISTS fornecedor_id UUID REFERENCES fornecedores(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_api_configs_fornecedor
  ON integrations_api_configs(fornecedor_id) WHERE fornecedor_id IS NOT NULL;

-- Add 'suppliers' to integration_providers category
-- Insert Edeltec provider into the catalog
INSERT INTO integration_providers (
  id, category, label, description, logo_key, status, auth_type,
  credential_schema, tutorial, capabilities, platform_managed_keys, popularity
) VALUES (
  gen_random_uuid(),
  'suppliers',
  'Edeltec Solar',
  'Sincronize o catálogo de kits geradores diretamente da Edeltec com preços atualizados.',
  'edeltec',
  'available',
  'api_key',
  '[{"key":"apiKey","label":"API Key","type":"text","required":true,"placeholder":"Sua API Key da Edeltec"},{"key":"secret","label":"Secret","type":"password","required":true,"placeholder":"Seu Secret da Edeltec"}]'::jsonb,
  '{"steps":["Acesse o painel da Edeltec e gere suas credenciais de API","Cole a API Key e o Secret nos campos acima","Clique em Testar Conexão para validar","Após conectar, clique em Sincronizar para importar kits"]}'::jsonb,
  '{"import_kits": true, "realtime_pricing": true, "stock_availability": true}'::jsonb,
  false,
  50
) ON CONFLICT DO NOTHING;

COMMENT ON COLUMN solar_kit_catalog.source IS 'Origem do kit: manual, edeltec, csv, api';
COMMENT ON COLUMN solar_kit_catalog.external_id IS 'ID do produto na API externa';
COMMENT ON COLUMN solar_kit_catalog.external_data IS 'Dados brutos da API externa para auditoria';
COMMENT ON COLUMN solar_kit_catalog.last_synced_at IS 'Última sincronização com fonte externa';
COMMENT ON COLUMN integrations_api_configs.fornecedor_id IS 'Fornecedor vinculado a esta configuração de API';
