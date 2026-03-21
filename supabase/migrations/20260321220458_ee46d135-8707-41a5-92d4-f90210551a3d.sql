-- Add storage optimization columns to unit_invoices
ALTER TABLE public.unit_invoices
  ADD COLUMN IF NOT EXISTS file_hash TEXT,
  ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS has_file BOOLEAN NOT NULL DEFAULT false;

-- Index for fast hash lookups (dedup)
CREATE INDEX IF NOT EXISTS idx_unit_invoices_file_hash
  ON public.unit_invoices (tenant_id, file_hash)
  WHERE file_hash IS NOT NULL;

COMMENT ON COLUMN public.unit_invoices.file_hash IS 'MD5/SHA hash of uploaded PDF for dedup';
COMMENT ON COLUMN public.unit_invoices.file_size_bytes IS 'File size in bytes';
COMMENT ON COLUMN public.unit_invoices.has_file IS 'Whether a PDF file is stored in storage';