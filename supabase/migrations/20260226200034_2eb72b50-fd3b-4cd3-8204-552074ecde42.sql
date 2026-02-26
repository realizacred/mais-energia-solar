
-- ═══════════════════════════════════════════════════════════
-- RECRIAÇÃO: INTEGRAÇÃO SOLARMARKET — Tabelas independentes
-- ═══════════════════════════════════════════════════════════

-- 1) solar_market_config — credenciais e config (1 por tenant, admin-only)
CREATE TABLE public.solar_market_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  enabled BOOLEAN NOT NULL DEFAULT false,
  base_url TEXT NOT NULL DEFAULT 'https://business.solarmarket.com.br/api/v2',
  api_token TEXT, -- stored via secrets; can also be per-tenant
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

ALTER TABLE public.solar_market_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view SM config" ON public.solar_market_config
  FOR SELECT USING (tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid()));
CREATE POLICY "Admin can insert SM config" ON public.solar_market_config
  FOR INSERT WITH CHECK (tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid()));
CREATE POLICY "Admin can update SM config" ON public.solar_market_config
  FOR UPDATE USING (tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid()));

-- 2) solar_market_clients — espelho de clientes SM
CREATE TABLE public.solar_market_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  sm_client_id BIGINT NOT NULL,
  name TEXT,
  email TEXT,
  phone TEXT,
  phone_normalized TEXT,
  document TEXT,
  address JSONB,
  raw_payload JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, sm_client_id)
);

CREATE INDEX idx_sm_clients_phone ON public.solar_market_clients (phone_normalized);
CREATE INDEX idx_sm_clients_sm_id ON public.solar_market_clients (sm_client_id);

ALTER TABLE public.solar_market_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view SM clients" ON public.solar_market_clients
  FOR SELECT USING (tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid()));
CREATE POLICY "Service role manages SM clients" ON public.solar_market_clients
  FOR ALL USING (true) WITH CHECK (true);

-- 3) solar_market_projects — espelho de projetos SM
CREATE TABLE public.solar_market_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  sm_project_id BIGINT NOT NULL,
  sm_client_id BIGINT,
  name TEXT,
  potencia_kwp NUMERIC,
  status TEXT,
  valor NUMERIC,
  raw_payload JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, sm_project_id)
);

CREATE INDEX idx_sm_projects_client ON public.solar_market_projects (sm_client_id);

ALTER TABLE public.solar_market_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view SM projects" ON public.solar_market_projects
  FOR SELECT USING (tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid()));
CREATE POLICY "Service role manages SM projects" ON public.solar_market_projects
  FOR ALL USING (true) WITH CHECK (true);

-- 4) solar_market_proposals — espelho de propostas SM
CREATE TABLE public.solar_market_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  sm_proposal_id BIGINT NOT NULL,
  sm_project_id BIGINT,
  sm_client_id BIGINT,
  titulo TEXT,
  potencia_kwp NUMERIC,
  valor_total NUMERIC,
  status TEXT,
  modulos TEXT,
  inversores TEXT,
  raw_payload JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, sm_proposal_id)
);

CREATE INDEX idx_sm_proposals_project ON public.solar_market_proposals (sm_project_id);
CREATE INDEX idx_sm_proposals_client ON public.solar_market_proposals (sm_client_id);

ALTER TABLE public.solar_market_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view SM proposals" ON public.solar_market_proposals
  FOR SELECT USING (tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid()));
CREATE POLICY "Service role manages SM proposals" ON public.solar_market_proposals
  FOR ALL USING (true) WITH CHECK (true);

-- 5) solar_market_sync_logs — logs de sincronização
CREATE TABLE public.solar_market_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  sync_type TEXT NOT NULL, -- 'clients', 'projects', 'proposals', 'full'
  status TEXT NOT NULL DEFAULT 'running', -- 'running', 'completed', 'error'
  total_fetched INT DEFAULT 0,
  total_upserted INT DEFAULT 0,
  total_errors INT DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.solar_market_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view SM sync logs" ON public.solar_market_sync_logs
  FOR SELECT USING (tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid()));
CREATE POLICY "Service role manages SM sync logs" ON public.solar_market_sync_logs
  FOR ALL USING (true) WITH CHECK (true);
