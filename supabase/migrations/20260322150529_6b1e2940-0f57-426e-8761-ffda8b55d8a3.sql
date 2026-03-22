-- Add GD consistency columns to unit_invoices
ALTER TABLE public.unit_invoices
  ADD COLUMN IF NOT EXISTS consistency_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS consistency_score numeric,
  ADD COLUMN IF NOT EXISTS consistency_checks_json jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS consistency_warnings_json jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS consistency_errors_json jsonb DEFAULT '[]'::jsonb;

-- Create index for consistency queries
CREATE INDEX IF NOT EXISTS idx_unit_invoices_consistency_status 
  ON public.unit_invoices(consistency_status) WHERE consistency_status != 'ok';

-- Create test extraction runs table
CREATE TABLE IF NOT EXISTS public.invoice_extraction_test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT (public.current_tenant_id()) REFERENCES public.tenants(id),
  concessionaria_code text,
  concessionaria_detected text,
  file_type text,
  is_textual boolean DEFAULT true,
  strategy_used text,
  parser_used text,
  parser_version text,
  status text NOT NULL DEFAULT 'pending',
  confidence_score numeric,
  fields_found jsonb DEFAULT '[]'::jsonb,
  fields_missing jsonb DEFAULT '[]'::jsonb,
  warnings jsonb DEFAULT '[]'::jsonb,
  errors jsonb DEFAULT '[]'::jsonb,
  consistency_result jsonb,
  raw_extraction jsonb,
  recommendation text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_extraction_test_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation test runs" ON public.invoice_extraction_test_runs
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE INDEX IF NOT EXISTS idx_test_runs_tenant ON public.invoice_extraction_test_runs(tenant_id);