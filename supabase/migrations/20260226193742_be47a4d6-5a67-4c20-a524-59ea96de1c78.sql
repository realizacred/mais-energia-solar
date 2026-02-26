-- Fix: recreate view without SECURITY DEFINER (views inherit RLS from base tables)
DROP VIEW IF EXISTS public.estoque_saldos;

CREATE OR REPLACE VIEW public.estoque_saldos WITH (security_invoker = true) AS
SELECT
  m.tenant_id,
  m.item_id,
  i.nome,
  i.sku,
  i.categoria,
  i.unidade,
  i.custo_medio,
  i.estoque_minimo,
  i.ativo,
  COALESCE(SUM(CASE WHEN m.tipo IN ('entrada', 'ajuste') THEN m.quantidade ELSE 0 END), 0)
  - COALESCE(SUM(CASE WHEN m.tipo = 'saida' THEN m.quantidade ELSE 0 END), 0) AS estoque_atual,
  COALESCE((SELECT SUM(r.quantidade_reservada) FROM public.estoque_reservas r WHERE r.item_id = m.item_id AND r.status = 'active'), 0) AS reservado
FROM public.estoque_movimentos m
JOIN public.estoque_itens i ON i.id = m.item_id
GROUP BY m.tenant_id, m.item_id, i.nome, i.sku, i.categoria, i.unidade, i.custo_medio, i.estoque_minimo, i.ativo;