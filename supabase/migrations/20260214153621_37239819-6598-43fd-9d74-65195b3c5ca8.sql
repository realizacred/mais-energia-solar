
-- Add accept/reject columns to proposta_aceite_tokens
ALTER TABLE public.proposta_aceite_tokens
  ADD COLUMN IF NOT EXISTS cenario_aceito_id UUID REFERENCES public.proposta_cenarios(id),
  ADD COLUMN IF NOT EXISTS decisao TEXT CHECK (decisao IN ('aceita', 'recusada')),
  ADD COLUMN IF NOT EXISTS recusa_motivo TEXT,
  ADD COLUMN IF NOT EXISTS recusa_at TIMESTAMPTZ;

-- Index for querying by cenario
CREATE INDEX IF NOT EXISTS idx_proposta_aceite_tokens_cenario
  ON public.proposta_aceite_tokens(cenario_aceito_id)
  WHERE cenario_aceito_id IS NOT NULL;

COMMENT ON COLUMN public.proposta_aceite_tokens.decisao IS 'aceita or recusada - the client decision';
COMMENT ON COLUMN public.proposta_aceite_tokens.cenario_aceito_id IS 'Which payment scenario the client chose when accepting';
