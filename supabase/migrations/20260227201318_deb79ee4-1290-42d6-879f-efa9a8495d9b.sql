
-- Backfill new columns from raw_payload variables
UPDATE solar_market_proposals SET
  link_pdf = raw_payload->>'linkPdf',
  generated_at = CASE WHEN raw_payload->>'generatedAt' IS NOT NULL AND raw_payload->>'generatedAt' != 'null' THEN (raw_payload->>'generatedAt')::timestamptz ELSE NULL END,
  send_at = CASE WHEN raw_payload->>'sendAt' IS NOT NULL AND raw_payload->>'sendAt' != 'null' THEN (raw_payload->>'sendAt')::timestamptz ELSE NULL END,
  viewed_at = CASE WHEN raw_payload->>'viewedAt' IS NOT NULL AND raw_payload->>'viewedAt' != 'null' THEN (raw_payload->>'viewedAt')::timestamptz ELSE NULL END,
  acceptance_date = CASE WHEN raw_payload->>'acceptanceDate' IS NOT NULL AND raw_payload->>'acceptanceDate' != 'null' THEN (raw_payload->>'acceptanceDate')::timestamptz ELSE NULL END,
  rejection_date = CASE WHEN raw_payload->>'rejectionDate' IS NOT NULL AND raw_payload->>'rejectionDate' != 'null' THEN (raw_payload->>'rejectionDate')::timestamptz ELSE NULL END,
  consumo_mensal = (SELECT (elem->>'value')::numeric FROM jsonb_array_elements(raw_payload->'variables') elem WHERE elem->>'key' = 'consumo_mensal' AND elem->>'value' IS NOT NULL AND elem->>'value' ~ '^[0-9.]+$' LIMIT 1),
  tarifa_distribuidora = (SELECT (elem->>'value')::numeric FROM jsonb_array_elements(raw_payload->'variables') elem WHERE elem->>'key' = 'tarifa_distribuidora' AND elem->>'value' IS NOT NULL AND elem->>'value' ~ '^[0-9.]+$' LIMIT 1),
  economia_mensal = (SELECT (elem->>'value')::numeric FROM jsonb_array_elements(raw_payload->'variables') elem WHERE elem->>'key' = 'economia_mensal' AND elem->>'value' IS NOT NULL AND (elem->>'value')::text ~ '^[0-9.]+$' LIMIT 1),
  economia_mensal_percent = (SELECT (elem->>'value')::numeric * 100 FROM jsonb_array_elements(raw_payload->'variables') elem WHERE elem->>'key' = 'economia_mensal_p' AND elem->>'value' IS NOT NULL AND (elem->>'value')::text ~ '^[0-9.]+$' LIMIT 1),
  payback = (SELECT elem->>'value' FROM jsonb_array_elements(raw_payload->'variables') elem WHERE elem->>'key' = 'payback' LIMIT 1),
  vpl = (SELECT (elem->>'value')::numeric FROM jsonb_array_elements(raw_payload->'variables') elem WHERE elem->>'key' = 'vpl' AND elem->>'value' IS NOT NULL AND (elem->>'value')::text ~ '^[0-9.]+$' LIMIT 1),
  tir = (SELECT (elem->>'value')::numeric FROM jsonb_array_elements(raw_payload->'variables') elem WHERE elem->>'key' = 'tir' AND elem->>'value' IS NOT NULL AND (elem->>'value')::text ~ '^[0-9.]+$' LIMIT 1),
  preco_total = (SELECT (elem->>'value')::numeric FROM jsonb_array_elements(raw_payload->'variables') elem WHERE elem->>'key' = 'preco' AND elem->>'value' IS NOT NULL AND (elem->>'value')::text ~ '^[0-9.]+$' LIMIT 1),
  fase = (SELECT elem->>'value' FROM jsonb_array_elements(raw_payload->'variables') elem WHERE elem->>'key' = 'fase' AND elem->>'value' IS NOT NULL LIMIT 1),
  tipo_dimensionamento = (SELECT elem->>'value' FROM jsonb_array_elements(raw_payload->'variables') elem WHERE elem->>'key' = 'tipo' AND elem->>'value' IS NOT NULL LIMIT 1),
  dis_energia = (SELECT elem->>'value' FROM jsonb_array_elements(raw_payload->'variables') elem WHERE elem->>'key' = 'dis_energia' AND elem->>'value' IS NOT NULL LIMIT 1),
  cidade = (SELECT elem->>'value' FROM jsonb_array_elements(raw_payload->'variables') elem WHERE elem->>'key' = 'cidade' AND elem->>'value' IS NOT NULL LIMIT 1),
  estado = (SELECT elem->>'value' FROM jsonb_array_elements(raw_payload->'variables') elem WHERE elem->>'key' = 'estado' AND elem->>'value' IS NOT NULL LIMIT 1),
  geracao_anual = (SELECT (elem->>'value')::numeric FROM jsonb_array_elements(raw_payload->'variables') elem WHERE elem->>'key' = 'geracao_anual_0' AND elem->>'value' IS NOT NULL AND (elem->>'value')::text ~ '^[0-9.]+$' LIMIT 1),
  inflacao_energetica = (SELECT (elem->>'value')::numeric FROM jsonb_array_elements(raw_payload->'variables') elem WHERE elem->>'key' = 'inflacao_energetica' AND elem->>'value' IS NOT NULL AND (elem->>'value')::text ~ '^[0-9.]+$' LIMIT 1),
  perda_eficiencia_anual = (SELECT (elem->>'value')::numeric FROM jsonb_array_elements(raw_payload->'variables') elem WHERE elem->>'key' = 'perda_eficiencia_anual' AND elem->>'value' IS NOT NULL AND (elem->>'value')::text ~ '^[0-9.]+$' LIMIT 1),
  sobredimensionamento = (SELECT (elem->>'value')::numeric FROM jsonb_array_elements(raw_payload->'variables') elem WHERE elem->>'key' = 'sobredimensionamento' AND elem->>'value' IS NOT NULL AND (elem->>'value')::text ~ '^[0-9.]+$' LIMIT 1),
  custo_disponibilidade = (SELECT (elem->>'value')::numeric FROM jsonb_array_elements(raw_payload->'variables') elem WHERE elem->>'key' = 'custo_disponibilidade_valor' AND elem->>'value' IS NOT NULL AND (elem->>'value')::text ~ '^[0-9.]+$' LIMIT 1)
WHERE raw_payload IS NOT NULL AND jsonb_typeof(raw_payload->'variables') = 'array';
