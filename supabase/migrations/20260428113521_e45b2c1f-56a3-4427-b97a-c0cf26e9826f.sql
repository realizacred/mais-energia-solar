-- Normalizar mapeamentos SolarMarket salvos com colchetes e remover duplicatas conflitantes.
WITH ranked AS (
  SELECT
    id,
    tenant_id,
    trim(both '[]' from sm_field_key) AS clean_key,
    row_number() OVER (
      PARTITION BY tenant_id, trim(both '[]' from sm_field_key)
      ORDER BY
        CASE WHEN action <> 'ignore' THEN 0 ELSE 1 END,
        CASE WHEN sm_field_key = trim(both '[]' from sm_field_key) THEN 0 ELSE 1 END,
        updated_at DESC,
        id
    ) AS rn
  FROM public.sm_custom_field_mapping
  WHERE trim(both '[]' from sm_field_key) ~ '^(cap|cape|capo|pre|pos)_[A-Za-z0-9_]+'
)
DELETE FROM public.sm_custom_field_mapping m
USING ranked r
WHERE m.id = r.id
  AND r.rn > 1;

WITH clean AS (
  SELECT id, trim(both '[]' from sm_field_key) AS clean_key
  FROM public.sm_custom_field_mapping
  WHERE sm_field_key LIKE '[%]'
    AND trim(both '[]' from sm_field_key) ~ '^(cap|cape|capo|pre|pos)_[A-Za-z0-9_]+'
)
UPDATE public.sm_custom_field_mapping m
SET sm_field_key = c.clean_key,
    updated_at = now()
FROM clean c
WHERE m.id = c.id;

-- Corrigir o field_key do campo Overlord para seguir o padrão global: pos_ para pós-dimensionamento.
UPDATE public.deal_custom_fields dcf
SET field_key = 'pos_overlord',
    updated_at = now()
FROM public.sm_custom_field_mapping m
WHERE dcf.id = m.crm_field_id
  AND dcf.tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'::uuid
  AND m.tenant_id = dcf.tenant_id
  AND m.sm_field_key = 'capo_overlord'
  AND dcf.field_context = 'pos_dimensionamento'
  AND dcf.field_key <> 'pos_overlord'
  AND NOT EXISTS (
    SELECT 1
    FROM public.deal_custom_fields existing
    WHERE existing.tenant_id = dcf.tenant_id
      AND existing.field_key = 'pos_overlord'
      AND existing.id <> dcf.id
  );

-- Atualizar RPC usada pelo promoter para auditar cap/cape/capo/pre/pos e normalizar chaves com colchetes.
CREATE OR REPLACE FUNCTION public.sm_distinct_proposta_variable_keys(p_tenant_id uuid)
RETURNS TABLE(key text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT trim(both '[]' from (var->>'key'))::text AS key
  FROM public.sm_propostas_raw r,
       LATERAL jsonb_array_elements(
         CASE
           WHEN jsonb_typeof(r.payload->'variables') = 'array'
           THEN r.payload->'variables'
           ELSE '[]'::jsonb
         END
       ) AS var
  WHERE r.tenant_id = p_tenant_id
    AND var->>'key' IS NOT NULL
    AND trim(both '[]' from (var->>'key')) ~ '^(cap|cape|capo|pre|pos)_';
$$;

GRANT EXECUTE ON FUNCTION public.sm_distinct_proposta_variable_keys(uuid) TO authenticated, service_role;