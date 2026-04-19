
-- ============================================================
-- SolarMarket Import Infrastructure
-- ============================================================

-- 1. Add external_source / external_id to native tables (idempotency)
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS external_source TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT;

ALTER TABLE public.projetos
  ADD COLUMN IF NOT EXISTS external_source TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT;

ALTER TABLE public.propostas_nativas
  ADD COLUMN IF NOT EXISTS external_source TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_external
  ON public.clientes (tenant_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_projetos_external
  ON public.projetos (tenant_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_propostas_nativas_external
  ON public.propostas_nativas (tenant_id, external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;

-- 2. solarmarket_import_jobs
CREATE TABLE IF NOT EXISTS public.solarmarket_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  triggered_by UUID,
  scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','success','partial','error','cancelled')),
  total_clientes INTEGER NOT NULL DEFAULT 0,
  total_projetos INTEGER NOT NULL DEFAULT 0,
  total_propostas INTEGER NOT NULL DEFAULT 0,
  total_funis INTEGER NOT NULL DEFAULT 0,
  total_custom_fields INTEGER NOT NULL DEFAULT 0,
  total_errors INTEGER NOT NULL DEFAULT 0,
  current_step TEXT,
  progress_pct NUMERIC(5,2) DEFAULT 0,
  error_message TEXT,
  logs JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sm_import_jobs_tenant
  ON public.solarmarket_import_jobs (tenant_id, created_at DESC);

ALTER TABLE public.solarmarket_import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant can view own import jobs"
  ON public.solarmarket_import_jobs FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Admin can insert import jobs"
  ON public.solarmarket_import_jobs FOR INSERT
  WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  );

CREATE POLICY "Admin can update import jobs"
  ON public.solarmarket_import_jobs FOR UPDATE
  USING (
    tenant_id = public.get_user_tenant_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  );

-- 3. solarmarket_import_logs
CREATE TABLE IF NOT EXISTS public.solarmarket_import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.solarmarket_import_jobs(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  external_id TEXT,
  internal_id UUID,
  action TEXT NOT NULL CHECK (action IN ('created','updated','skipped','error')),
  error_message TEXT,
  payload_snippet JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sm_import_logs_job
  ON public.solarmarket_import_logs (job_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sm_import_logs_tenant_entity
  ON public.solarmarket_import_logs (tenant_id, entity_type, action);

ALTER TABLE public.solarmarket_import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant can view own import logs"
  ON public.solarmarket_import_logs FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Service role can insert import logs"
  ON public.solarmarket_import_logs FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- 4. Trigger updated_at
CREATE TRIGGER trg_sm_import_jobs_updated
  BEFORE UPDATE ON public.solarmarket_import_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.solarmarket_import_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.solarmarket_import_logs;
