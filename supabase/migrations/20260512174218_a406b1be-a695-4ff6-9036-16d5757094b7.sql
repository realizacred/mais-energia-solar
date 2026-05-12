
INSERT INTO deal_custom_field_values (deal_id, field_id, tenant_id, value_text)
SELECT n.deal_id, n.field_id, n.tenant_id, n.val
FROM (
  WITH sm_projs AS (
    SELECT p.id AS projeto_id, p.deal_id, p.tenant_id, p.external_id
    FROM projetos p
    WHERE p.external_source = 'solarmarket'
      AND p.deal_id IS NOT NULL
      AND p.external_id IS NOT NULL
  ),
  latest_payload AS (
    SELECT DISTINCT ON (sp.projeto_id)
      sp.projeto_id, sp.deal_id, sp.tenant_id, sp.external_id, spr.payload
    FROM sm_projs sp
    JOIN sm_propostas_raw spr
      ON spr.payload->>'_sm_project_id' = sp.external_id
    ORDER BY sp.projeto_id, (spr.payload->>'generatedAt') DESC NULLS LAST
  ),
  exploded AS (
    SELECT lp.deal_id, lp.tenant_id,
           v.value->>'key' AS k,
           COALESCE(NULLIF(v.value->>'value',''), v.value->>'formattedValue') AS val
    FROM latest_payload lp,
         jsonb_array_elements(lp.payload->'variables') v
    WHERE v.value->>'key' IN ('cap_disjuntor','cap_localizacao','cap_transformador')
  )
  SELECT e.deal_id, e.tenant_id, e.val,
         dcf.id AS field_id
  FROM exploded e
  JOIN deal_custom_fields dcf
    ON dcf.tenant_id = e.tenant_id
   AND dcf.field_key = e.k
   AND dcf.is_active = true
  WHERE e.val IS NOT NULL AND e.val <> ''
) n
WHERE NOT EXISTS (
  SELECT 1 FROM deal_custom_field_values dcv
  WHERE dcv.deal_id = n.deal_id AND dcv.field_id = n.field_id
);
