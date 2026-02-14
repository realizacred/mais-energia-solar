
-- ═══════════════════════════════════════════════════════
-- FASE 2 (RETRY): MIGRAÇÃO COMPLETA DE DADOS
-- ═══════════════════════════════════════════════════════

-- 1. projeto_funis → pipelines
INSERT INTO pipelines (id, tenant_id, name, version, is_active, created_at)
SELECT id, tenant_id, nome, 1, ativo, COALESCE(created_at, now())
FROM projeto_funis
ON CONFLICT DO NOTHING;

-- 2. projeto_etapas → pipeline_stages
INSERT INTO pipeline_stages (id, tenant_id, pipeline_id, name, position, probability, is_closed, is_won, created_at)
SELECT 
  id, tenant_id, funil_id, nome, ordem,
  CASE categoria::text
    WHEN 'aberto' THEN 50.00
    WHEN 'ganho' THEN 100.00
    WHEN 'perdido' THEN 0.00
    WHEN 'excluido' THEN 0.00
    ELSE 50.00
  END,
  CASE WHEN categoria::text IN ('ganho', 'perdido', 'excluido') THEN true ELSE false END,
  CASE WHEN categoria::text = 'ganho' THEN true ELSE false END,
  now()
FROM projeto_etapas
WHERE funil_id IN (SELECT id FROM projeto_funis)
ON CONFLICT DO NOTHING;

-- 3. projetos → deals
INSERT INTO deals (id, tenant_id, pipeline_id, stage_id, customer_id, owner_id, title, value, status, created_at, updated_at)
SELECT
  p.id, p.tenant_id, p.funil_id, p.etapa_id, p.cliente_id, p.consultor_id,
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
  p.created_at, p.updated_at
FROM projetos p
WHERE p.funil_id IS NOT NULL
  AND p.etapa_id IS NOT NULL
  AND p.consultor_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM pipelines pl WHERE pl.id = p.funil_id)
  AND EXISTS (SELECT 1 FROM pipeline_stages ps WHERE ps.id = p.etapa_id)
ON CONFLICT DO NOTHING;
