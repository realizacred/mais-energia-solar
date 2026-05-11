ALTER TABLE public.projeto_homologacao 
ADD COLUMN IF NOT EXISTS previsao_aprovacao DATE;

CREATE INDEX IF NOT EXISTS idx_projeto_homologacao_previsao 
ON public.projeto_homologacao(previsao_aprovacao);