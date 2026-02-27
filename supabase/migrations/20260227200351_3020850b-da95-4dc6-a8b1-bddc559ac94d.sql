
-- Re-extract proposal fields from raw_payload using safe text-based casts
UPDATE solar_market_proposals SET
  titulo = COALESCE(raw_payload->>'title', raw_payload->>'titulo', raw_payload->>'name'),
  sm_project_id = COALESCE(
    (raw_payload->'project'->>'id')::bigint,
    (raw_payload->>'projectId')::bigint,
    (raw_payload->>'project_id')::bigint
  ),
  sm_client_id = COALESCE(
    (raw_payload->>'clientId')::bigint,
    (raw_payload->>'client_id')::bigint,
    (raw_payload->'project'->'client'->>'id')::bigint
  ),
  description = COALESCE(raw_payload->>'description', raw_payload->>'descricao'),
  status = raw_payload->>'status',
  valid_until = CASE WHEN raw_payload->>'expirationDate' IS NOT NULL THEN (raw_payload->>'expirationDate')::timestamptz ELSE NULL END,
  sm_created_at = CASE WHEN raw_payload->>'createdAt' IS NOT NULL THEN (raw_payload->>'createdAt')::timestamptz ELSE NULL END,
  panel_model = (
    SELECT elem->>'item' FROM jsonb_array_elements(raw_payload->'pricingTable') elem
    WHERE elem->>'category' = 'Módulo' LIMIT 1
  ),
  panel_quantity = (
    SELECT (elem->>'qnt')::int FROM jsonb_array_elements(raw_payload->'pricingTable') elem
    WHERE elem->>'category' = 'Módulo' LIMIT 1
  ),
  inverter_model = (
    SELECT elem->>'item' FROM jsonb_array_elements(raw_payload->'pricingTable') elem
    WHERE elem->>'category' = 'Inversor' LIMIT 1
  ),
  inverter_quantity = (
    SELECT (elem->>'qnt')::int FROM jsonb_array_elements(raw_payload->'pricingTable') elem
    WHERE elem->>'category' = 'Inversor' LIMIT 1
  ),
  modulos = (
    SELECT (elem->>'item') || ' (' || (elem->>'qnt') || 'x)' FROM jsonb_array_elements(raw_payload->'pricingTable') elem
    WHERE elem->>'category' = 'Módulo' LIMIT 1
  ),
  inversores = (
    SELECT (elem->>'item') || ' (' || (elem->>'qnt') || 'x)' FROM jsonb_array_elements(raw_payload->'pricingTable') elem
    WHERE elem->>'category' = 'Inversor' LIMIT 1
  ),
  equipment_cost = (
    SELECT (elem->>'salesValue')::numeric FROM jsonb_array_elements(raw_payload->'pricingTable') elem
    WHERE elem->>'category' = 'KIT' LIMIT 1
  ),
  installation_cost = (
    SELECT (elem->>'salesValue')::numeric FROM jsonb_array_elements(raw_payload->'pricingTable') elem
    WHERE elem->>'category' = 'Instalação' LIMIT 1
  ),
  valor_total = (
    SELECT COALESCE(SUM((elem->>'salesValue')::numeric), 0)
    FROM jsonb_array_elements(raw_payload->'pricingTable') elem
  ),
  potencia_kwp = (
    SELECT (elem->>'value')::numeric FROM jsonb_array_elements(raw_payload->'variables') elem
    WHERE elem->>'key' = 'potencia_sistema' AND elem->>'value' IS NOT NULL 
    AND elem->>'value' ~ '^[0-9.]+$' LIMIT 1
  ),
  energy_generation = (
    SELECT (elem->>'value')::numeric FROM jsonb_array_elements(raw_payload->'variables') elem
    WHERE elem->>'key' = 'geracao_mensal' AND elem->>'value' IS NOT NULL 
    AND elem->>'value' ~ '^[0-9.]+$' LIMIT 1
  ),
  roof_type = (
    SELECT elem->>'value' FROM jsonb_array_elements(raw_payload->'variables') elem
    WHERE elem->>'key' = 'tipo_telhado' AND elem->>'value' IS NOT NULL LIMIT 1
  ),
  structure_type = (
    SELECT elem->>'value' FROM jsonb_array_elements(raw_payload->'variables') elem
    WHERE elem->>'key' = 'tipo_estrutura' AND elem->>'value' IS NOT NULL LIMIT 1
  )
WHERE raw_payload IS NOT NULL 
  AND jsonb_typeof(raw_payload->'pricingTable') = 'array';
