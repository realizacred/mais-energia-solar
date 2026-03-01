
-- ═══════════════════════════════════════════════════════════
-- Integration Framework V2 — Generic multi-provider tables
-- ═══════════════════════════════════════════════════════════

-- 1) integration_providers (catálogo SSOT — sem tenant_id, global)
CREATE TABLE IF NOT EXISTS public.integration_providers (
  id text PRIMARY KEY,
  category text NOT NULL,
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  logo_key text,
  status text NOT NULL DEFAULT 'coming_soon' CHECK (status IN ('available','coming_soon','maintenance')),
  auth_type text NOT NULL DEFAULT 'api_key',
  credential_schema jsonb NOT NULL DEFAULT '[]'::jsonb,
  tutorial jsonb NOT NULL DEFAULT '{}'::jsonb,
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  platform_managed_keys boolean NOT NULL DEFAULT false,
  popularity integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) integration_connections (per tenant + provider)
CREATE TABLE IF NOT EXISTS public.integration_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider_id text NOT NULL REFERENCES public.integration_providers(id),
  status text NOT NULL DEFAULT 'disconnected' CHECK (status IN ('disconnected','connected','error','maintenance')),
  credentials jsonb NOT NULL DEFAULT '{}'::jsonb,
  tokens jsonb NOT NULL DEFAULT '{}'::jsonb,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_sync_at timestamptz,
  sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, provider_id)
);

-- 3) integration_jobs (sync/job tracking)
CREATE TABLE IF NOT EXISTS public.integration_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider_id text NOT NULL REFERENCES public.integration_providers(id),
  connection_id uuid REFERENCES public.integration_connections(id) ON DELETE SET NULL,
  job_type text NOT NULL DEFAULT 'sync_full' CHECK (job_type IN ('sync_full','sync_partial','webhook_ingest','token_refresh')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','success','error')),
  started_at timestamptz,
  finished_at timestamptz,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════
-- Indexes
-- ═══════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_integration_providers_category ON public.integration_providers(category);
CREATE INDEX IF NOT EXISTS idx_integration_providers_status ON public.integration_providers(status);
CREATE INDEX IF NOT EXISTS idx_integration_connections_tenant ON public.integration_connections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_integration_connections_provider ON public.integration_connections(provider_id);
CREATE INDEX IF NOT EXISTS idx_integration_connections_status ON public.integration_connections(status);
CREATE INDEX IF NOT EXISTS idx_integration_jobs_tenant ON public.integration_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_integration_jobs_connection ON public.integration_jobs(connection_id);
CREATE INDEX IF NOT EXISTS idx_integration_jobs_status ON public.integration_jobs(status);

-- ═══════════════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════════════

-- integration_providers is a global catalog — readable by all authenticated
ALTER TABLE public.integration_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read providers catalog"
  ON public.integration_providers FOR SELECT
  TO authenticated
  USING (true);

-- integration_connections — tenant-isolated
ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant can view own connections"
  ON public.integration_connections FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant can insert own connections"
  ON public.integration_connections FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant can update own connections"
  ON public.integration_connections FOR UPDATE
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant can delete own connections"
  ON public.integration_connections FOR DELETE
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- integration_jobs — tenant-isolated
ALTER TABLE public.integration_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant can view own jobs"
  ON public.integration_jobs FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant can insert own jobs"
  ON public.integration_jobs FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant can update own jobs"
  ON public.integration_jobs FOR UPDATE
  TO authenticated
  USING (tenant_id = public.current_tenant_id());
