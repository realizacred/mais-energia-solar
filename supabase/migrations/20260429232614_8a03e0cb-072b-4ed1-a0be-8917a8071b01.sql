-- Sweep external_entity_links órfãos: links de cliente apontando para clientes deletados
-- (consequência de dedup colapsando 1.935 → 892 clientes durante a migração SM).
-- Não afeta links de projeto/proposta. Idempotente.
DELETE FROM public.external_entity_links eel
WHERE eel.source IN ('solarmarket','solar_market')
  AND eel.source_entity_type = 'cliente'
  AND eel.entity_type = 'cliente'
  AND NOT EXISTS (
    SELECT 1 FROM public.clientes c WHERE c.id = eel.entity_id::uuid
  );

-- Reabre o job mestre c6c0431e que foi marcado completed_with_warnings prematuramente
-- (countBacklog antigo retornava 0 ignorando 844 propostas em projetos com funil "Vendedores").
-- Após o deploy do fix em sm-migrate-chunk + sm-promote, o backlog real será detectado.
UPDATE public.solarmarket_promotion_jobs
SET status = 'running',
    finished_at = NULL,
    error_summary = NULL,
    last_step_at = now(),
    updated_at = now()
WHERE id = 'c6c0431e-a490-436b-96e1-30e08f055a15'
  AND tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
  AND status IN ('completed','completed_with_warnings','failed','cancelled');