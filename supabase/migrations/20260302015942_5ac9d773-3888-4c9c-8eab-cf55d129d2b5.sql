
-- Fix: remove "SolarZAPI" placeholder from Huawei FusionSolar credential_schema
UPDATE integration_providers
SET credential_schema = jsonb_set(
  credential_schema,
  '{1,placeholder}',
  '"Ex: MaisEnergiaAPI"'
)
WHERE id = 'huawei_fusionsolar'
  AND credential_schema->1->>'placeholder' = 'Ex: SolarZAPI';

-- Fix: remove "SolarZ" references from Huawei FusionSolar tutorial steps
UPDATE integration_providers
SET tutorial = jsonb_set(
  tutorial,
  '{steps}',
  (
    SELECT jsonb_agg(
      CASE 
        WHEN value::text LIKE '%SolarZAPI%' 
        THEN to_jsonb(replace(value::text, 'SolarZAPI', 'MaisEnergiaAPI')::text)
        ELSE value
      END
    )
    FROM jsonb_array_elements(tutorial->'steps') AS value
  )
)
WHERE id = 'huawei_fusionsolar'
  AND tutorial::text LIKE '%SolarZ%';

-- Fix: remove "SolarZ" from Solis Cloud tutorial if present
UPDATE integration_providers
SET tutorial = jsonb_set(
  tutorial,
  '{steps}',
  (
    SELECT jsonb_agg(
      CASE 
        WHEN value::text LIKE '%SolarZ%' 
        THEN to_jsonb(replace(replace(value::text, 'SolarZ', 'Mais Energia'), '"', '')::text)
        ELSE value
      END
    )
    FROM jsonb_array_elements(tutorial->'steps') AS value
  )
)
WHERE id = 'solis_cloud'
  AND tutorial::text LIKE '%SolarZ%';
