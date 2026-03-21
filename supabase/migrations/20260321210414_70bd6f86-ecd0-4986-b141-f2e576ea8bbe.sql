-- 1. invoice_import_jobs — persistent job tracking for invoice imports
CREATE TABLE public.invoice_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT (current_setting('request.jwt.claims'::text, true)::json ->> 'tenant_id')::uuid REFERENCES public.tenants(id),
  source text NOT NULL DEFAULT 'upload',
  status text NOT NULL DEFAULT 'queued',
  total_files integer NOT NULL DEFAULT 0,
  processed_files integer NOT NULL DEFAULT 0,
  success_count integer NOT NULL DEFAULT 0,
  duplicate_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  started_at timestamptz,
  finished_at timestamptz,
  summary_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_import_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.invoice_import_jobs
  FOR ALL USING (tenant_id = public.current_tenant_id());

-- 2. invoice_import_job_items — per-file tracking within a job
CREATE TABLE public.invoice_import_job_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT (current_setting('request.jwt.claims'::text, true)::json ->> 'tenant_id')::uuid REFERENCES public.tenants(id),
  job_id uuid NOT NULL REFERENCES public.invoice_import_jobs(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  unit_id uuid REFERENCES public.units_consumidoras(id) ON DELETE SET NULL,
  reference_year integer,
  reference_month integer,
  status text NOT NULL DEFAULT 'processing',
  error_message text,
  parser_summary_json jsonb,
  invoice_id uuid REFERENCES public.unit_invoices(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_import_job_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.invoice_import_job_items
  FOR ALL USING (tenant_id = public.current_tenant_id());

-- Indexes
CREATE INDEX idx_import_jobs_tenant ON public.invoice_import_jobs(tenant_id, created_at DESC);
CREATE INDEX idx_import_job_items_job ON public.invoice_import_job_items(job_id);
CREATE INDEX idx_import_jobs_status ON public.invoice_import_jobs(status) WHERE status IN ('queued', 'processing');