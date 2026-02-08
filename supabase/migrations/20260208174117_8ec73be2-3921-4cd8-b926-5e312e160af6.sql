
-- Novos campos na tabela obras para dados técnicos, tags e vínculo com projeto
ALTER TABLE public.obras
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS marca_paineis text,
  ADD COLUMN IF NOT EXISTS tempo_instalacao_dias integer,
  ADD COLUMN IF NOT EXISTS depoimento_cliente text,
  ADD COLUMN IF NOT EXISTS payback_meses integer,
  ADD COLUMN IF NOT EXISTS projeto_id uuid REFERENCES public.projetos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL;

-- Índice para busca por tags
CREATE INDEX IF NOT EXISTS idx_obras_tags ON public.obras USING GIN(tags);

-- Comentários para documentação
COMMENT ON COLUMN public.obras.tags IS 'Tags descritivas como telhado-metalico, bifacial, microinversor';
COMMENT ON COLUMN public.obras.marca_paineis IS 'Fabricante/modelo dos módulos solares';
COMMENT ON COLUMN public.obras.tempo_instalacao_dias IS 'Tempo total da instalação em dias';
COMMENT ON COLUMN public.obras.depoimento_cliente IS 'Citação/avaliação do cliente sobre o projeto';
COMMENT ON COLUMN public.obras.payback_meses IS 'Tempo estimado de retorno do investimento em meses';
COMMENT ON COLUMN public.obras.projeto_id IS 'Vínculo opcional com projeto cadastrado';
COMMENT ON COLUMN public.obras.cliente_id IS 'Vínculo opcional com cliente cadastrado';
