-- 1. Add identifier columns to units_consumidoras
ALTER TABLE public.units_consumidoras
  ADD COLUMN IF NOT EXISTS unit_identifier text,
  ADD COLUMN IF NOT EXISTS unit_identifier_type text DEFAULT 'numero_uc';

-- 2. Add identifier_field to extraction configs
ALTER TABLE public.invoice_extraction_configs
  ADD COLUMN IF NOT EXISTS identifier_field text DEFAULT 'numero_uc';

-- 3. Add ownership validation columns to unit_invoices
ALTER TABLE public.unit_invoices
  ADD COLUMN IF NOT EXISTS ownership_validation_status text DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS ownership_validation_score integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS identifier_extracted text,
  ADD COLUMN IF NOT EXISTS identifier_expected text,
  ADD COLUMN IF NOT EXISTS needs_manual_assignment boolean DEFAULT false;

-- 4. Add ownership columns to extraction runs
ALTER TABLE public.invoice_extraction_runs
  ADD COLUMN IF NOT EXISTS ownership_validation_status text,
  ADD COLUMN IF NOT EXISTS ownership_validation_score integer,
  ADD COLUMN IF NOT EXISTS identifier_extracted text,
  ADD COLUMN IF NOT EXISTS identifier_matched boolean;

-- 5. Backfill unit_identifier from codigo_uc for existing UCs
UPDATE public.units_consumidoras
SET unit_identifier = codigo_uc
WHERE unit_identifier IS NULL AND codigo_uc IS NOT NULL;

-- 6. Set identifier_field for known concessionárias
UPDATE public.invoice_extraction_configs
SET identifier_field = 'numero_uc'
WHERE identifier_field IS NULL;

-- 7. Index for ownership lookups
CREATE INDEX IF NOT EXISTS idx_units_consumidoras_unit_identifier
  ON public.units_consumidoras (tenant_id, unit_identifier)
  WHERE unit_identifier IS NOT NULL;