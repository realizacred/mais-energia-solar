
-- Adicionar ícone e lista de pipelines visíveis aos tipos de atividade
ALTER TABLE public.deal_activity_types
  ADD COLUMN icon TEXT DEFAULT 'circle-dot',
  ADD COLUMN pipeline_ids UUID[] DEFAULT '{}';

COMMENT ON COLUMN public.deal_activity_types.icon IS 'Lucide icon name (kebab-case). NULL ou vazio = ícone padrão.';
COMMENT ON COLUMN public.deal_activity_types.pipeline_ids IS 'IDs dos pipelines onde este tipo é visível. Vazio = todos os pipelines.';
