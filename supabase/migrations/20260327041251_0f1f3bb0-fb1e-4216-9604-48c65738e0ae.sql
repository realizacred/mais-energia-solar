-- Sync deals.value from the principal proposal's latest version valor_total
-- This ensures the Kanban always shows the active proposal's value

-- 1. Update set_proposta_principal to also sync deals.value
CREATE OR REPLACE FUNCTION public.set_proposta_principal(
  _deal_id UUID,
  _proposta_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _valor NUMERIC(15,2);
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

  -- Sync deal value from the latest version of the principal proposal
  SELECT pv.valor_total INTO _valor
  FROM proposta_versoes pv
  WHERE pv.proposta_id = _proposta_id
  ORDER BY pv.versao_numero DESC
  LIMIT 1;

  IF _valor IS NOT NULL AND _valor > 0 THEN
    UPDATE deals SET value = _valor, updated_at = now()
    WHERE id = _deal_id;
  END IF;
END;
$$;

-- 2. Trigger: when a proposta_versoes is inserted/updated, sync value to deal if it's the principal
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
  -- Check if this version's proposal is the principal
  SELECT pn.deal_id, pn.is_principal
  INTO _deal_id, _is_principal
  FROM propostas_nativas pn
  WHERE pn.id = NEW.proposta_id;

  IF _deal_id IS NOT NULL AND _is_principal = true AND NEW.valor_total IS NOT NULL AND NEW.valor_total > 0 THEN
    UPDATE deals SET value = NEW.valor_total, updated_at = now()
    WHERE id = _deal_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop if exists to avoid conflict
DROP TRIGGER IF EXISTS trg_sync_deal_value_on_versao ON proposta_versoes;

CREATE TRIGGER trg_sync_deal_value_on_versao
AFTER INSERT OR UPDATE OF valor_total ON proposta_versoes
FOR EACH ROW
EXECUTE FUNCTION public.sync_deal_value_from_versao();

-- 3. Backfill: sync current deals from their principal proposals
UPDATE deals d
SET value = sub.valor_total, updated_at = now()
FROM (
  SELECT DISTINCT ON (pn.deal_id)
    pn.deal_id,
    pv.valor_total
  FROM propostas_nativas pn
  JOIN proposta_versoes pv ON pv.proposta_id = pn.id
  WHERE pn.is_principal = true
    AND pn.deal_id IS NOT NULL
    AND pv.valor_total IS NOT NULL
    AND pv.valor_total > 0
  ORDER BY pn.deal_id, pv.versao_numero DESC
) sub
WHERE d.id = sub.deal_id;