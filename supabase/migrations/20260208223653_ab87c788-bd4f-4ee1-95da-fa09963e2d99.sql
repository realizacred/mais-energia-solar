
-- Fix tenant_id
UPDATE solar_market_config 
SET tenant_id = '00000000-0000-0000-0000-000000000001' 
WHERE tenant_id IS NULL;

-- ============================================================
-- NOVAS TABELAS
-- ============================================================

CREATE TABLE IF NOT EXISTS solar_market_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  sm_user_id BIGINT NOT NULL,
  name TEXT,
  email TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, sm_user_id)
);

CREATE TABLE IF NOT EXISTS solar_market_custom_fields (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  sm_project_id BIGINT NOT NULL,
  sm_custom_field_id BIGINT NOT NULL,
  field_key TEXT,
  field_type TEXT,
  value TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, sm_project_id, sm_custom_field_id)
);

CREATE TABLE IF NOT EXISTS solar_market_funnels_catalog (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  sm_funnel_id BIGINT NOT NULL,
  name TEXT,
  stages JSONB NOT NULL DEFAULT '[]',
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, sm_funnel_id)
);

CREATE TABLE IF NOT EXISTS solar_market_custom_fields_catalog (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  sm_custom_field_id BIGINT NOT NULL,
  field_key TEXT,
  field_type TEXT,
  label TEXT,
  options JSONB,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, sm_custom_field_id)
);

-- ============================================================
-- ALTER webhook_events (já existe com schema antigo)
-- ============================================================
ALTER TABLE solar_market_webhook_events
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS entity_id BIGINT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS retries INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

-- ALTER outras tabelas existentes
ALTER TABLE solar_market_proposals 
  ADD COLUMN IF NOT EXISTS pricing_table JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS variables JSONB DEFAULT '{}';

ALTER TABLE solar_market_config
  ADD COLUMN IF NOT EXISTS last_sync_clients_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_sync_projects_at TIMESTAMPTZ;

ALTER TABLE solar_market_clients
  ADD COLUMN IF NOT EXISTS cnpj_cpf TEXT,
  ADD COLUMN IF NOT EXISTS primary_phone TEXT,
  ADD COLUMN IF NOT EXISTS secondary_phone TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state VARCHAR(2),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE solar_market_projects
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_sm_clients_phone ON solar_market_clients(phone_normalized) WHERE phone_normalized IS NOT NULL AND phone_normalized != '';
CREATE INDEX IF NOT EXISTS idx_sm_clients_tenant ON solar_market_clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sm_projects_tenant_client ON solar_market_projects(tenant_id, sm_client_id);
CREATE INDEX IF NOT EXISTS idx_sm_proposals_tenant_project ON solar_market_proposals(tenant_id, sm_project_id);
CREATE INDEX IF NOT EXISTS idx_sm_custom_fields_tenant_project ON solar_market_custom_fields(tenant_id, sm_project_id);
CREATE INDEX IF NOT EXISTS idx_sm_webhook_events_status ON solar_market_webhook_events(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_sm_proposals_variables ON solar_market_proposals USING GIN(variables);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE solar_market_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE solar_market_custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE solar_market_funnels_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE solar_market_custom_fields_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage SM users" ON solar_market_users
  FOR ALL TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admins can manage SM custom fields" ON solar_market_custom_fields
  FOR ALL TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admins can manage SM webhook events" ON solar_market_webhook_events
  FOR ALL TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admins can manage SM funnels catalog" ON solar_market_funnels_catalog
  FOR ALL TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admins can manage SM custom fields catalog" ON solar_market_custom_fields_catalog
  FOR ALL TO authenticated USING (is_admin(auth.uid()));

-- ============================================================
-- TRIGGERS
-- ============================================================
CREATE TRIGGER update_sm_users_updated_at
  BEFORE UPDATE ON solar_market_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sm_custom_fields_updated_at
  BEFORE UPDATE ON solar_market_custom_fields
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sm_funnels_catalog_updated_at
  BEFORE UPDATE ON solar_market_funnels_catalog
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sm_cf_catalog_updated_at
  BEFORE UPDATE ON solar_market_custom_fields_catalog
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
