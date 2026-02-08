
-- ═══════════════════════════════════════════════════════════
-- INTEGRAÇÃO SOLARMARKET — Tabelas espelho + vínculos + logs
-- ═══════════════════════════════════════════════════════════

-- 1) solar_market_config — credenciais e config (admin-only)
CREATE TABLE public.solar_market_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  enabled BOOLEAN NOT NULL DEFAULT false,
  base_url TEXT NOT NULL DEFAULT 'https://business.solarmarket.com.br/api/v2',
  auth_email TEXT,
  auth_password_encrypted TEXT, -- never sent to frontend; used only in edge fns
  last_token TEXT, -- cached token (edge fn only)
  last_token_expires_at TIMESTAMPTZ,
  webhook_secret TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.solar_market_config IS 'Configuração da integração SolarMarket (1 por tenant). Apenas admin pode ver/editar.';

-- 2) solar_market_clients
CREATE TABLE public.solar_market_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  sm_client_id BIGINT NOT NULL,
  name TEXT,
  email TEXT,
  phone TEXT,
  phone_normalized TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, sm_client_id)
);

CREATE INDEX idx_sm_clients_phone ON public.solar_market_clients (phone_normalized);
CREATE INDEX idx_sm_clients_sm_id ON public.solar_market_clients (sm_client_id);

COMMENT ON TABLE public.solar_market_clients IS 'Espelho de clientes do SolarMarket, sincronizado via edge functions.';

-- 3) solar_market_projects
CREATE TABLE public.solar_market_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  sm_project_id BIGINT NOT NULL,
  sm_client_id BIGINT NOT NULL,
  status TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, sm_project_id)
);

CREATE INDEX idx_sm_projects_client ON public.solar_market_projects (sm_client_id);

COMMENT ON TABLE public.solar_market_projects IS 'Espelho de projetos do SolarMarket, vinculados a clientes SM.';

-- 4) solar_market_proposals
CREATE TABLE public.solar_market_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  sm_proposal_id BIGINT NOT NULL,
  sm_project_id BIGINT NOT NULL,
  sm_client_id BIGINT NOT NULL,
  status TEXT,
  generated_at TIMESTAMPTZ,
  acceptance_date TIMESTAMPTZ,
  rejection_date TIMESTAMPTZ,
  expiration_date TIMESTAMPTZ,
  link_pdf TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, sm_proposal_id)
);

CREATE INDEX idx_sm_proposals_project ON public.solar_market_proposals (sm_project_id);
CREATE INDEX idx_sm_proposals_client ON public.solar_market_proposals (sm_client_id);

COMMENT ON TABLE public.solar_market_proposals IS 'Espelho de propostas do SolarMarket, vinculadas a projetos SM.';

-- 5) solar_market_funnels
CREATE TABLE public.solar_market_funnels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  sm_project_id BIGINT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, sm_project_id)
);

CREATE INDEX idx_sm_funnels_project ON public.solar_market_funnels (sm_project_id);

COMMENT ON TABLE public.solar_market_funnels IS 'Espelho de funis/etapas do SolarMarket por projeto.';

-- 6) solar_market_sync_logs
CREATE TABLE public.solar_market_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running', -- running | success | fail | partial
  error TEXT,
  counts JSONB DEFAULT '{}',
  triggered_by UUID, -- user_id
  source TEXT NOT NULL DEFAULT 'manual', -- manual | cron | n8n | webhook
  mode TEXT NOT NULL DEFAULT 'full', -- full | delta
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.solar_market_sync_logs IS 'Logs de sincronização com SolarMarket, para auditoria e debug.';

-- 7) solar_market_webhook_events
CREATE TABLE public.solar_market_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  event_type TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed BOOLEAN NOT NULL DEFAULT false,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.solar_market_webhook_events IS 'Eventos recebidos via webhook do SolarMarket.';

-- 8) lead_links — vínculo automático Lead ↔ SM Client/Project
CREATE TABLE public.lead_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  sm_client_id BIGINT NOT NULL,
  sm_project_id BIGINT,
  link_reason TEXT NOT NULL DEFAULT 'auto_phone_match',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, lead_id, sm_client_id)
);

CREATE INDEX idx_lead_links_lead ON public.lead_links (lead_id);
CREATE INDEX idx_lead_links_sm_client ON public.lead_links (sm_client_id);

COMMENT ON TABLE public.lead_links IS 'Vínculos automáticos entre leads do CRM e clientes/projetos do SolarMarket.';

-- ═══════════════════════════════════════
-- RLS — Ativar em todas as tabelas
-- ═══════════════════════════════════════

ALTER TABLE public.solar_market_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solar_market_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solar_market_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solar_market_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solar_market_funnels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solar_market_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solar_market_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_links ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════
-- RLS Policies — solar_market_config (admin-only)
-- ═══════════════════════════════════════

CREATE POLICY "Admin can view SM config"
  ON public.solar_market_config FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admin can insert SM config"
  ON public.solar_market_config FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admin can update SM config"
  ON public.solar_market_config FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admin can delete SM config"
  ON public.solar_market_config FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- ═══════════════════════════════════════
-- RLS Policies — espelho tables (admin + service_role)
-- ═══════════════════════════════════════

-- solar_market_clients
CREATE POLICY "Admin can manage SM clients"
  ON public.solar_market_clients FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Service role full access SM clients"
  ON public.solar_market_clients FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- solar_market_projects
CREATE POLICY "Admin can manage SM projects"
  ON public.solar_market_projects FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Service role full access SM projects"
  ON public.solar_market_projects FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- solar_market_proposals
CREATE POLICY "Admin can manage SM proposals"
  ON public.solar_market_proposals FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Service role full access SM proposals"
  ON public.solar_market_proposals FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- solar_market_funnels
CREATE POLICY "Admin can manage SM funnels"
  ON public.solar_market_funnels FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Service role full access SM funnels"
  ON public.solar_market_funnels FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- solar_market_sync_logs
CREATE POLICY "Admin can view SM sync logs"
  ON public.solar_market_sync_logs FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Service role full access SM sync logs"
  ON public.solar_market_sync_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- solar_market_webhook_events
CREATE POLICY "Admin can view SM webhook events"
  ON public.solar_market_webhook_events FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Service role full access SM webhook events"
  ON public.solar_market_webhook_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- lead_links
CREATE POLICY "Admin can manage lead links"
  ON public.lead_links FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Service role full access lead links"
  ON public.lead_links FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ═══════════════════════════════════════
-- Triggers — updated_at automático
-- ═══════════════════════════════════════

CREATE TRIGGER update_sm_config_updated_at
  BEFORE UPDATE ON public.solar_market_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sm_clients_updated_at
  BEFORE UPDATE ON public.solar_market_clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sm_projects_updated_at
  BEFORE UPDATE ON public.solar_market_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sm_proposals_updated_at
  BEFORE UPDATE ON public.solar_market_proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sm_funnels_updated_at
  BEFORE UPDATE ON public.solar_market_funnels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
