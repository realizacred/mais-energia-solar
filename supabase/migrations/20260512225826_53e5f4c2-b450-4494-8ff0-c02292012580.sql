-- Backfill project_documents from sm_propostas_raw using external S3 URLs
WITH expanded AS (
  SELECT
    spr.tenant_id,
    spr.external_id AS sm_proposal_id,
    v.value->>'key' AS field_key,
    btrim(u.url) AS url
  FROM sm_propostas_raw spr
  CROSS JOIN LATERAL jsonb_array_elements(spr.payload->'variables') v
  CROSS JOIN LATERAL unnest(string_to_array(v.value->>'value', '|')) AS u(url)
  WHERE v.value->>'key' IN ('cap_identidade','cap_comprovante_endereco')
    AND spr.tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
),
clean AS (
  SELECT DISTINCT ON (url)
    tenant_id, sm_proposal_id, field_key, url
  FROM expanded
  WHERE url ILIKE 'http%'
),
resolved AS (
  SELECT
    c.*,
    -- map sm proposal id (e.g. "10:2") to project external_id ("2" = project)
    split_part(c.sm_proposal_id, ':', 2) AS sm_project_external_id
  FROM clean c
),
joined AS (
  SELECT
    r.*,
    p.id AS projeto_id,
    p.deal_id,
    p.cliente_id
  FROM resolved r
  LEFT JOIN projetos p
    ON p.tenant_id = r.tenant_id
   AND p.external_source = 'solarmarket'
   AND p.external_id = r.sm_project_external_id
)
INSERT INTO project_documents (
  tenant_id, projeto_id, deal_id, cliente_id,
  categoria, origem, bucket, storage_path,
  file_name, mime_type, source_table, metadata
)
SELECT
  j.tenant_id,
  j.projeto_id,
  j.deal_id,
  j.cliente_id,
  CASE j.field_key
    WHEN 'cap_identidade' THEN 'Identidade'
    WHEN 'cap_comprovante_endereco' THEN 'Comprovante de Endereço'
    ELSE j.field_key
  END,
  'legacy',
  'external',
  j.url,
  COALESCE(NULLIF(split_part(split_part(j.url, '?', 1), '/', -1), ''), 'documento'),
  CASE
    WHEN j.url ILIKE '%.pdf%' THEN 'application/pdf'
    WHEN j.url ILIKE '%.png%' THEN 'image/png'
    WHEN j.url ILIKE '%.webp%' THEN 'image/webp'
    WHEN j.url ILIKE '%.gif%' THEN 'image/gif'
    ELSE 'image/jpeg'
  END,
  'sm_propostas_raw',
  jsonb_build_object(
    'sm_url', j.url,
    'sm_field_key', j.field_key,
    'sm_proposal_id', j.sm_proposal_id,
    'external', true
  )
FROM joined j
ON CONFLICT (bucket, storage_path) DO NOTHING;