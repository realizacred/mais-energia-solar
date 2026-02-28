
-- Add migration selection columns
ALTER TABLE public.solar_market_proposals
  ADD COLUMN IF NOT EXISTS migrar_para_canonico boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS migrar_requested_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS migrar_requested_by uuid NULL;

-- Partial index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_smp_tenant_migrar
  ON public.solar_market_proposals (tenant_id, migrar_para_canonico)
  WHERE migrar_para_canonico = true;
