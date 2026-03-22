-- Add parsing metadata columns to unit_invoices
ALTER TABLE public.unit_invoices
  ADD COLUMN IF NOT EXISTS parsing_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS parsing_error_reason TEXT,
  ADD COLUMN IF NOT EXISTS parser_version TEXT,
  ADD COLUMN IF NOT EXISTS last_parsed_at TIMESTAMPTZ;

-- Backfill existing invoices: if raw_extraction has data → success, otherwise pending
UPDATE public.unit_invoices
SET parsing_status = CASE 
  WHEN raw_extraction IS NOT NULL AND raw_extraction::text != '{}' AND raw_extraction::text != 'null' THEN 'success'
  ELSE 'pending'
END,
last_parsed_at = CASE
  WHEN raw_extraction IS NOT NULL AND raw_extraction::text != '{}' AND raw_extraction::text != 'null' THEN updated_at
  ELSE NULL
END;