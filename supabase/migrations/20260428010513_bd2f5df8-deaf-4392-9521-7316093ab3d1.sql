-- RPC para extrair chaves DISTINCT de variables nos payloads SM
-- Evita carregar 2000 payloads JSONB na edge function (memory crash)
CREATE OR REPLACE FUNCTION public.sm_distinct_proposta_variable_keys(p_tenant_id uuid)
RETURNS TABLE(key text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT (var->>'key')::text AS key
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
    AND (var->>'key') ~ '^(cap|capo|cape)_';
$$;

GRANT EXECUTE ON FUNCTION public.sm_distinct_proposta_variable_keys(uuid) TO authenticated, service_role;