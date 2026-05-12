WITH legacy AS (
  SELECT dcv.deal_id, dcv.field_id, dcf.field_key
  FROM deal_custom_field_values dcv
  JOIN deal_custom_fields dcf ON dcf.id = dcv.field_id
  WHERE dcf.field_key IN ('cap_identidade','cap_comprovante_endereco')
    AND dcv.tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
    AND dcv.value_text NOT ILIKE '%http%'
),
sm_urls AS (
  SELECT
    p.deal_id,
    v.value->>'key' AS field_key,
    p.created_at AS sm_created_at,
    v.value->>'value' AS raw_value
  FROM sm_propostas_raw spr
  JOIN projetos p ON p.external_source='solarmarket'
    AND p.external_id = spr.payload->>'_sm_project_id'
    AND p.tenant_id = spr.tenant_id
  CROSS JOIN LATERAL jsonb_array_elements(spr.payload->'variables') v
  WHERE spr.tenant_id='17de8315-2e2f-4a79-8751-e5d507d69a41'
    AND v.value->>'key' IN ('cap_identidade','cap_comprovante_endereco')
    AND v.value->>'value' ILIKE 'http%'
),
exploded AS (
  SELECT
    l.deal_id, l.field_id, l.field_key,
    s.sm_created_at,
    trim(url) AS url,
    regexp_replace(split_part(split_part(trim(url), '?', 1), '/', -1), '%20', ' ', 'g') AS filename
  FROM legacy l
  JOIN sm_urls s ON s.deal_id = l.deal_id AND s.field_key = l.field_key
  CROSS JOIN LATERAL string_to_table(s.raw_value, ' | ') AS url
  WHERE trim(url) ILIKE 'http%'
),
agg AS (
  SELECT
    e.deal_id, e.field_id,
    jsonb_agg(jsonb_build_object(
      'storage_path', e.url,
      'filename', e.filename,
      'mime', CASE lower(regexp_replace(e.filename, '.*\.([a-zA-Z0-9]+)$', '\1'))
        WHEN 'pdf' THEN 'application/pdf'
        WHEN 'jpg' THEN 'image/jpeg'
        WHEN 'jpeg' THEN 'image/jpeg'
        WHEN 'png' THEN 'image/png'
        WHEN 'webp' THEN 'image/webp'
        WHEN 'gif' THEN 'image/gif'
        WHEN 'heic' THEN 'image/heic'
        ELSE 'image/jpeg' END,
      'size', NULL,
      'uploaded_at', COALESCE(e.sm_created_at, now())
    ) ORDER BY e.url) AS new_arr
  FROM exploded e
  GROUP BY e.deal_id, e.field_id
)
UPDATE deal_custom_field_values dcv
SET value_text = a.new_arr::text
FROM agg a
WHERE dcv.deal_id = a.deal_id AND dcv.field_id = a.field_id;