-- Drop the OLD overload (p_payback_meses integer, p_potencia_kwp default 0)
-- Keep the NEWER one (p_payback_meses numeric, p_potencia_kwp default NULL)
DROP FUNCTION IF EXISTS public.proposal_create_version(
  uuid, uuid, jsonb, numeric, numeric, numeric, numeric, text, text, text, text, text, integer, text, uuid, integer
);