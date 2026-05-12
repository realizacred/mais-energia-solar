CREATE OR REPLACE FUNCTION public.sync_deal_value_from_versao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _deal_id UUID;
  _is_principal BOOLEAN;
BEGIN
  -- Guard: short-circuit if value did not actually change (prevents audit loops)
  IF TG_OP = 'UPDATE' AND NEW.valor_total IS NOT DISTINCT FROM OLD.valor_total THEN
    RETURN NEW;
  END IF;

  -- Resolve deal + principal flag from parent proposta
  SELECT pn.deal_id, pn.is_principal
  INTO _deal_id, _is_principal
  FROM propostas_nativas pn
  WHERE pn.id = NEW.proposta_id;

  IF _deal_id IS NOT NULL
     AND _is_principal = true
     AND NEW.valor_total IS NOT NULL
     AND NEW.valor_total > 0 THEN
    -- Extra guard: only UPDATE when deals.value would actually change
    UPDATE deals
       SET value = NEW.valor_total,
           updated_at = now()
     WHERE id = _deal_id
       AND value IS DISTINCT FROM NEW.valor_total;
  END IF;

  RETURN NEW;
END;
$$;