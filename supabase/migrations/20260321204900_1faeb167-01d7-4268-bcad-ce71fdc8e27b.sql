-- Add generation source metadata to gd_monthly_snapshots
ALTER TABLE public.gd_monthly_snapshots
  ADD COLUMN IF NOT EXISTS generation_source_type text NOT NULL DEFAULT 'missing',
  ADD COLUMN IF NOT EXISTS generation_source_id uuid,
  ADD COLUMN IF NOT EXISTS generation_source_confidence text NOT NULL DEFAULT 'missing',
  ADD COLUMN IF NOT EXISTS generation_source_notes text;

COMMENT ON COLUMN public.gd_monthly_snapshots.generation_source_type IS 'meter | monitoring | invoice | missing';
COMMENT ON COLUMN public.gd_monthly_snapshots.generation_source_confidence IS 'high | medium | low | missing';