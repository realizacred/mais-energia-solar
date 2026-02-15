
-- Table for async import jobs
CREATE TABLE IF NOT EXISTS public.solar_import_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  dataset_key TEXT NOT NULL,
  idempotency_key TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','success','failed')),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  error_message TEXT,
  row_count INTEGER,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint for idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_solar_import_jobs_idempotency 
  ON public.solar_import_jobs(tenant_id, idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_solar_import_jobs_tenant_status 
  ON public.solar_import_jobs(tenant_id, status);

ALTER TABLE public.solar_import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant import jobs"
  ON public.solar_import_jobs FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Service role can manage import jobs"
  ON public.solar_import_jobs FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_solar_import_jobs_updated_at
  BEFORE UPDATE ON public.solar_import_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Table for import job logs
CREATE TABLE IF NOT EXISTS public.solar_import_job_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.solar_import_jobs(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info','warn','error')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_solar_import_job_logs_job 
  ON public.solar_import_job_logs(job_id, created_at);

ALTER TABLE public.solar_import_job_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant job logs"
  ON public.solar_import_job_logs FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Service role can manage job logs"
  ON public.solar_import_job_logs FOR ALL
  USING (true)
  WITH CHECK (true);
