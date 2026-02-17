
-- Criar pipeline "Comercial" com etapas padrão de funil de vendas
-- Usar o tenant_id dos deals existentes para garantir isolamento

INSERT INTO public.pipelines (name, kind, is_active, tenant_id)
SELECT 'Comercial', 'process'::pipeline_kind, true, tenant_id
FROM public.pipelines
WHERE name = 'Vendedor'
LIMIT 1;

-- Criar etapas para o pipeline Comercial
INSERT INTO public.pipeline_stages (pipeline_id, tenant_id, name, position, probability, is_closed, is_won)
SELECT p.id, p.tenant_id, s.name, s.pos, s.prob, s.closed, s.won
FROM public.pipelines p
CROSS JOIN (VALUES
  ('Prospecção', 0, 10, false, false),
  ('Qualificação', 1, 25, false, false),
  ('Proposta Enviada', 2, 50, false, false),
  ('Negociação', 3, 75, false, false),
  ('Ganho', 4, 100, true, true),
  ('Perdido', 5, 0, true, false)
) AS s(name, pos, prob, closed, won)
WHERE p.name = 'Comercial';
