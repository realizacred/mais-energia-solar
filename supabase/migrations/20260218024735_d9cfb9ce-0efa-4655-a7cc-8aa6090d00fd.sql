
-- Add motivo_perda fields to deals table for project loss tracking
ALTER TABLE public.deals 
  ADD COLUMN IF NOT EXISTS motivo_perda_id UUID REFERENCES public.motivos_perda(id),
  ADD COLUMN IF NOT EXISTS motivo_perda_obs TEXT;

-- Index for reporting
CREATE INDEX IF NOT EXISTS idx_deals_motivo_perda ON public.deals(motivo_perda_id) WHERE motivo_perda_id IS NOT NULL;
