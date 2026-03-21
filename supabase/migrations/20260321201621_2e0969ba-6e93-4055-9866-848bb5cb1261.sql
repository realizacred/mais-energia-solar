-- Unique index to prevent duplicate invoices per UC per reference period
CREATE UNIQUE INDEX IF NOT EXISTS idx_unit_invoices_unique_ref
  ON public.unit_invoices (tenant_id, unit_id, reference_month, reference_year)
  WHERE status != 'deleted';