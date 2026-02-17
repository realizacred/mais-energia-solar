
-- Adicionar motivo de perda em projetos (reutilizando tabela motivos_perda existente - SSOT)
ALTER TABLE public.projetos
  ADD COLUMN motivo_perda_id UUID REFERENCES public.motivos_perda(id) ON DELETE SET NULL,
  ADD COLUMN motivo_perda_obs TEXT;

-- Index para queries de análise de perdas por projeto
CREATE INDEX idx_projetos_motivo_perda ON public.projetos(motivo_perda_id) WHERE motivo_perda_id IS NOT NULL;

COMMENT ON COLUMN public.projetos.motivo_perda_id IS 'Motivo de perda quando status = perdido. FK para motivos_perda (SSOT compartilhada com leads).';
COMMENT ON COLUMN public.projetos.motivo_perda_obs IS 'Observação adicional sobre o motivo de perda do projeto.';
