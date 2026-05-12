WITH targets AS (
  SELECT dcv.deal_id, dcv.field_id, dcv.value_text
  FROM deal_custom_field_values dcv
  JOIN deal_custom_fields dcf ON dcf.id = dcv.field_id
  WHERE dcf.field_key IN ('cap_identidade','cap_comprovante_endereco')
    AND dcv.tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
    AND dcv.value_text IS NOT NULL
    AND dcv.value_text <> ''
    AND dcv.value_text <> '[]'
),
parsed AS (
  SELECT
    t.deal_id,
    t.field_id,
    (t.value_text)::jsonb AS arr
  FROM targets t
  WHERE left(btrim(t.value_text), 1) = '['
),
needs_convert AS (
  -- only rows where AT LEAST ONE element is a bare string
  SELECT p.deal_id, p.field_id, p.arr
  FROM parsed p
  WHERE EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p.arr) e
    WHERE jsonb_typeof(e) = 'string'
  )
),
converted AS (
  SELECT
    nc.deal_id,
    nc.field_id,
    jsonb_agg(
      CASE
        WHEN jsonb_typeof(e) = 'string' THEN
          jsonb_build_object(
            'storage_path', e #>> '{}',
            'filename', split_part(e #>> '{}', '/', -1),
            'mime', CASE lower(regexp_replace(split_part(e #>> '{}', '/', -1), '.*\.([a-zA-Z0-9]+)$', '\1'))
              WHEN 'pdf'  THEN 'application/pdf'
              WHEN 'jpg'  THEN 'image/jpeg'
              WHEN 'jpeg' THEN 'image/jpeg'
              WHEN 'png'  THEN 'image/png'
              WHEN 'webp' THEN 'image/webp'
              WHEN 'gif'  THEN 'image/gif'
              WHEN 'heic' THEN 'image/heic'
              ELSE 'image/jpeg'
            END,
            'size', NULL,
            'uploaded_at', NULL
          )
        ELSE e
      END
      ORDER BY ord
    ) AS new_arr
  FROM needs_convert nc
  CROSS JOIN LATERAL jsonb_array_elements(nc.arr) WITH ORDINALITY AS x(e, ord)
  GROUP BY nc.deal_id, nc.field_id
)
UPDATE deal_custom_field_values dcv
SET value_text = c.new_arr::text
FROM converted c
WHERE dcv.deal_id = c.deal_id
  AND dcv.field_id = c.field_id;