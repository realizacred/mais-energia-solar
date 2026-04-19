
-- Complementa piloto: caso "mais completo" (maior valor approved) e caso "mais minimal migrável" (menor valor)
WITH ja_marcadas AS (
  SELECT id FROM solar_market_proposals
   WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
     AND migrar_para_canonico = true AND migrado_em IS NULL
),
candidatos AS (
  SELECT p.id, p.valor_total
    FROM solar_market_proposals p
   WHERE p.tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
     AND p.migrado_em IS NULL
     AND p.sm_project_id IS NOT NULL
     AND p.id NOT IN (SELECT id FROM ja_marcadas)
),
mais_completo AS (
  SELECT id FROM candidatos WHERE valor_total IS NOT NULL ORDER BY valor_total DESC LIMIT 1
),
mais_minimal AS (
  SELECT id FROM candidatos WHERE valor_total IS NOT NULL ORDER BY valor_total ASC LIMIT 1
)
UPDATE solar_market_proposals p
   SET migrar_para_canonico = true, migrar_requested_at = now()
 WHERE p.tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
   AND p.id IN (SELECT id FROM mais_completo UNION SELECT id FROM mais_minimal);
