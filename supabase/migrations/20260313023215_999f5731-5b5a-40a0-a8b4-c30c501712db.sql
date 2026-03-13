CREATE OR REPLACE FUNCTION public.next_proposta_versao_numero(_proposta_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _next integer;
BEGIN
  -- Lock the proposta row to serialize concurrent version creation
  PERFORM 1 FROM propostas_nativas WHERE id = _proposta_id FOR UPDATE;

  SELECT COALESCE(MAX(versao_numero), 0) + 1
  INTO _next
  FROM proposta_versoes
  WHERE proposta_id = _proposta_id;

  UPDATE propostas_nativas
  SET versao_atual = _next, updated_at = now()
  WHERE id = _proposta_id;

  RETURN _next;
END;
$$;