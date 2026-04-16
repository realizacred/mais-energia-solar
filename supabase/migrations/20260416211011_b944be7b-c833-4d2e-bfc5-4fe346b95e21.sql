-- RB-56: adiciona coluna card_visible_fields em projeto_etapas
-- (já existe em pipeline_stages; necessária para o Kanban de Projetos
-- controlar quais campos aparecem nos cards.)
ALTER TABLE public.projeto_etapas
  ADD COLUMN IF NOT EXISTS card_visible_fields text[]
  DEFAULT ARRAY['valor_projeto','potencia_kwp','cidade']::text[];