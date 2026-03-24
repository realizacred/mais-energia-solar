
-- Atomic RPC to set proposta principal per deal (transaction-safe)
CREATE OR REPLACE FUNCTION public.set_proposta_principal(
  _deal_id UUID,
  _proposta_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Clear all principals for this deal
  UPDATE propostas_nativas
  SET is_principal = false
  WHERE deal_id = _deal_id
    AND is_principal = true
    AND tenant_id = (SELECT tenant_id FROM propostas_nativas WHERE id = _proposta_id);

  -- Set the selected one as principal
  UPDATE propostas_nativas
  SET is_principal = true
  WHERE id = _proposta_id
    AND deal_id = _deal_id;
END;
$$;
