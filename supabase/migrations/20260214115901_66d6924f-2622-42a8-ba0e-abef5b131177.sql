
-- ═══════════════════════════════════════════════════════
-- FASE 2: MIGRAÇÃO DE DADOS (LEGACY → PIPELINE ENGINE)
-- Pipelines e stages já foram migrados na tentativa anterior.
-- Agora: projetos → deals com cast correto do enum.
-- ═══════════════════════════════════════════════════════

INSERT INTO deals (id, tenant_id, pipeline_id, stage_id, customer_id, owner_id, title, value, status, created_at, updated_at)
SELECT
  p.id,
  p.tenant_id,
  p.funil_id,
  p.etapa_id,
  p.cliente_id,
  p.consultor_id,
  COALESCE(
    (SELECT c.nome FROM clientes c WHERE c.id = p.cliente_id LIMIT 1),
    COALESCE(p.codigo, 'Projeto ' || LEFT(p.id::text, 8))
  ),
  COALESCE(p.valor_total, 0),
  CASE p.status::text
    WHEN 'concluido' THEN 'won'
    WHEN 'comissionado' THEN 'won'
    WHEN 'cancelado' THEN 'lost'
    ELSE 'open'
  END,
  p.created_at,
  p.updated_at
FROM projetos p
WHERE p.funil_id IS NOT NULL
  AND p.etapa_id IS NOT NULL
  AND p.consultor_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM pipelines pl WHERE pl.id = p.funil_id)
  AND EXISTS (SELECT 1 FROM pipeline_stages ps WHERE ps.id = p.etapa_id)
ON CONFLICT DO NOTHING;
