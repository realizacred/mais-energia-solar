WITH field_defs AS (
  SELECT id AS field_id, field_key
  FROM deal_custom_fields
  WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
    AND field_key IN ('cap_identidade', 'cap_comprovante_endereco')
),
raw_vars AS (
  SELECT
    spr.tenant_id,
    p.id AS projeto_id,
    p.deal_id,
    p.created_at AS sm_created_at,
    v.value->>'key' AS field_key,
    v.value->>'value' AS raw_value
  FROM sm_propostas_raw spr
  JOIN projetos p
    ON p.external_source = 'solarmarket'
   AND p.external_id = spr.payload->>'_sm_project_id'
   AND p.tenant_id = spr.tenant_id
  CROSS JOIN LATERAL jsonb_array_elements(spr.payload->'variables') v
  WHERE spr.tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
    AND v.value->>'key' IN ('cap_identidade', 'cap_comprovante_endereco')
    AND v.value->>'value' ILIKE 'http%'
    AND p.deal_id IS NOT NULL
),
exploded AS (
  SELECT
    rv.tenant_id,
    rv.deal_id,
    rv.field_key,
    rv.sm_created_at,
    trim(url) AS url,
    regexp_replace(
      split_part(split_part(trim(url), '?', 1), '/', -1),
      '%20', ' ', 'g'
    ) AS filename
  FROM raw_vars rv
  CROSS JOIN LATERAL string_to_table(rv.raw_value, ' | ') AS url
  WHERE trim(url) ILIKE 'http%'
),
with_mime AS (
  SELECT
    e.*,
    CASE lower(regexp_replace(e.filename, '.*\.([a-zA-Z0-9]+)$', '\1'))
      WHEN 'pdf'  THEN 'application/pdf'
      WHEN 'jpg'  THEN 'image/jpeg'
      WHEN 'jpeg' THEN 'image/jpeg'
      WHEN 'png'  THEN 'image/png'
      WHEN 'webp' THEN 'image/webp'
      WHEN 'gif'  THEN 'image/gif'
      WHEN 'heic' THEN 'image/heic'
      ELSE 'application/octet-stream'
    END AS mime
  FROM exploded e
),
agg AS (
  SELECT
    wm.deal_id,
    wm.tenant_id,
    fd.field_id,
    jsonb_agg(
      jsonb_build_object(
        'storage_path', wm.url,
        'filename', wm.filename,
        'mime', wm.mime,
        'size', NULL,
        'uploaded_at', COALESCE(wm.sm_created_at, now())
      )
      ORDER BY wm.url
    ) AS files_json
  FROM with_mime wm
  JOIN field_defs fd ON fd.field_key = wm.field_key
  GROUP BY wm.deal_id, wm.tenant_id, fd.field_id
)
INSERT INTO deal_custom_field_values (deal_id, field_id, tenant_id, value_text)
SELECT deal_id, field_id, tenant_id, files_json::text
FROM agg
ON CONFLICT (deal_id, field_id) DO UPDATE
SET value_text = EXCLUDED.value_text
WHERE deal_custom_field_values.value_text IS NULL
   OR deal_custom_field_values.value_text = ''
   OR deal_custom_field_values.value_text = '[]';