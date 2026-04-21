-- D2: Marcar stage "Fechado" do pipeline Comercial como ganho (is_won) e fechado (is_closed).
-- Aplicado para todos os tenants, em qualquer pipeline cujo nome seja "Comercial" (case-insensitive).
-- Idempotente: só altera linhas que ainda não estão com is_won=true.
UPDATE public.pipeline_stages ps
SET is_won = true,
    is_closed = true
FROM public.pipelines p
WHERE ps.pipeline_id = p.id
  AND lower(p.name) = 'comercial'
  AND lower(ps.name) IN ('fechado', 'ganho', 'venda fechada')
  AND (ps.is_won IS DISTINCT FROM true OR ps.is_closed IS DISTINCT FROM true);