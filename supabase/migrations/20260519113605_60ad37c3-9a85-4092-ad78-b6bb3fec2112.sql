-- Drop the legacy version of the function with 4 arguments
DROP FUNCTION IF EXISTS public.convert_lead_to_venda_v2(uuid, jsonb, jsonb, text);

-- The canonical version with 6 arguments (oid: 4528636) is preserved as it is the only one remaining after this drop.
-- It was already correctly updated in the previous step to handle _is_pending.
