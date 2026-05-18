-- Adicionar colunas para suportar o sistema legiado de funis (projeto_funis)
ALTER TABLE public.pipeline_automations
ADD COLUMN IF NOT EXISTS funil_projeto_id UUID REFERENCES public.projeto_funis(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS etapa_projeto_id UUID REFERENCES public.projeto_etapas(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS destino_etapa_projeto_id UUID REFERENCES public.projeto_etapas(id) ON DELETE SET NULL;

-- Tornar pipeline_id e stage_id opcionais para permitir o uso das novas colunas
ALTER TABLE public.pipeline_automations ALTER COLUMN pipeline_id DROP NOT NULL;
ALTER TABLE public.pipeline_automations ALTER COLUMN stage_id DROP NOT NULL;

COMMENT ON COLUMN public.pipeline_automations.funil_projeto_id IS 'ID do funil na tabela projeto_funis (sistema legado).';
COMMENT ON COLUMN public.pipeline_automations.etapa_projeto_id IS 'ID da etapa na tabela projeto_etapas (sistema legado).';
COMMENT ON COLUMN public.pipeline_automations.destino_etapa_projeto_id IS 'ID da etapa de destino na tabela projeto_etapas (sistema legado).';