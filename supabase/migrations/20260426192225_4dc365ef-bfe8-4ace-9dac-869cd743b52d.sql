-- 1) Cancelar jobs órfãos de promoção (concorrência)
UPDATE solarmarket_promotion_jobs
SET status='cancelled', finished_at=now()
WHERE tenant_id='17de8315-2e2f-4a79-8751-e5d507d69a41'
  AND status='running';

-- 2) Cascatear valor_total das versões para projetos (RB-67)
UPDATE projetos p
SET valor_total = sub.valor_total,
    proposta_id = sub.proposta_id,
    updated_at = now()
FROM (
  SELECT DISTINCT ON (pn.projeto_id)
    pn.projeto_id,
    pn.id AS proposta_id,
    pv.valor_total
  FROM propostas_nativas pn
  JOIN proposta_versoes pv ON pv.proposta_id = pn.id
  WHERE pn.tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
    AND pn.external_source IN ('solarmarket','solar_market')
    AND pv.valor_total > 0
  ORDER BY pn.projeto_id, pv.created_at DESC
) sub
WHERE p.id = sub.projeto_id;

-- 3) Cascatear potencia_kwp do staging para versões e projetos
UPDATE proposta_versoes pv
SET potencia_kwp = NULLIF(REPLACE(REPLACE(var->>'value','.',''),',','.'),'')::numeric
FROM propostas_nativas pn
JOIN sm_propostas_raw sr ON split_part(sr.payload->>'_sm_proposal_id', ':', 1) = pn.external_id
  AND sr.tenant_id = pn.tenant_id
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(sr.payload->'variables','[]'::jsonb)) AS var
WHERE pv.proposta_id = pn.id
  AND pn.tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
  AND pn.external_source IN ('solarmarket','solar_market')
  AND var->>'key' = 'potencia_sistema'
  AND COALESCE(pv.potencia_kwp,0) = 0;

-- 4) Cascatear potencia_kwp das versões para projetos
UPDATE projetos p
SET potencia_kwp = sub.potencia_kwp,
    updated_at = now()
FROM (
  SELECT DISTINCT ON (pn.projeto_id)
    pn.projeto_id,
    pv.potencia_kwp
  FROM propostas_nativas pn
  JOIN proposta_versoes pv ON pv.proposta_id = pn.id
  WHERE pn.tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
    AND pn.external_source IN ('solarmarket','solar_market')
    AND COALESCE(pv.potencia_kwp,0) > 0
  ORDER BY pn.projeto_id, pv.created_at DESC
) sub
WHERE p.id = sub.projeto_id;