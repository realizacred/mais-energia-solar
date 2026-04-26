
-- 1) Cancelar jobs órfãos
UPDATE solarmarket_promotion_jobs
SET status='cancelled',
    finished_at=now()
WHERE tenant_id='17de8315-2e2f-4a79-8751-e5d507d69a41'
  AND status='running'
  AND (last_step_at IS NULL OR last_step_at < now() - interval '5 minutes');

-- 2) Backfill potencia_kwp nas versões SM
WITH src AS (
  SELECT DISTINCT ON (sr.payload->>'_sm_project_id')
    sr.payload->>'_sm_project_id' AS proj_id,
    NULLIF(
      (SELECT v->>'value' FROM jsonb_array_elements(sr.payload->'variables') v
       WHERE v->>'key' = 'potencia_sistema' LIMIT 1),
    '')::numeric AS potencia
  FROM sm_propostas_raw sr
  WHERE sr.tenant_id='17de8315-2e2f-4a79-8751-e5d507d69a41'
)
UPDATE proposta_versoes pv
SET potencia_kwp = src.potencia,
    updated_at = now()
FROM propostas_nativas pn, src
WHERE pv.proposta_id = pn.id
  AND pn.tenant_id='17de8315-2e2f-4a79-8751-e5d507d69a41'
  AND pn.external_source IN ('solar_market','solarmarket')
  AND src.proj_id = pn.external_id
  AND src.potencia IS NOT NULL
  AND COALESCE(pv.potencia_kwp,0) = 0;

-- 3) Cascatear proposta_id + valor_total + potencia_kwp para projetos SM
WITH versao_principal AS (
  SELECT DISTINCT ON (pn.id)
    pn.id AS proposta_id,
    pn.deal_id,
    pn.external_id,
    pv.id AS versao_id,
    pv.valor_total,
    pv.potencia_kwp
  FROM propostas_nativas pn
  JOIN proposta_versoes pv ON pv.proposta_id = pn.id
  WHERE pn.tenant_id='17de8315-2e2f-4a79-8751-e5d507d69a41'
    AND pn.external_source IN ('solar_market','solarmarket')
  ORDER BY pn.id, pv.created_at DESC NULLS LAST
)
UPDATE projetos p
SET 
  proposta_id = vp.proposta_id,
  valor_total = COALESCE(NULLIF(vp.valor_total,0), p.valor_total),
  potencia_kwp = COALESCE(NULLIF(vp.potencia_kwp,0), p.potencia_kwp),
  updated_at = now()
FROM versao_principal vp
WHERE p.tenant_id='17de8315-2e2f-4a79-8751-e5d507d69a41'
  AND p.external_source IN ('solar_market','solarmarket')
  AND p.deal_id = vp.deal_id;

-- 4) Sincronizar deals.value com projetos.valor_total
UPDATE deals d
SET value = p.valor_total,
    updated_at = now()
FROM projetos p
WHERE p.deal_id = d.id
  AND p.tenant_id='17de8315-2e2f-4a79-8751-e5d507d69a41'
  AND p.external_source IN ('solar_market','solarmarket')
  AND COALESCE(p.valor_total,0) > 0
  AND COALESCE(d.value,0) <> COALESCE(p.valor_total,0);
