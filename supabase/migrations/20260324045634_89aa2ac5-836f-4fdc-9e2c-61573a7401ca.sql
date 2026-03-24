
-- invoice_processing_logs: operational observability for invoice pipeline
CREATE TABLE public.invoice_processing_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT (current_tenant_id()) REFERENCES public.tenants(id),
  unit_id UUID REFERENCES public.units_consumidoras(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, success, error, skipped
  message TEXT,
  source TEXT, -- email, upload, manual, test
  invoice_id UUID,
  error_details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.invoice_processing_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.invoice_processing_logs
  FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id());

-- Index for querying by unit
CREATE INDEX idx_ipl_unit_id ON public.invoice_processing_logs(unit_id, created_at DESC);
CREATE INDEX idx_ipl_tenant ON public.invoice_processing_logs(tenant_id, created_at DESC);
