
-- Update trigger to also handle the dummy default UUID
CREATE OR REPLACE FUNCTION public.resolve_lead_vendedor_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _dummy_uuid uuid := '00000000-0000-0000-0000-000000000000'::uuid;
BEGIN
  -- Fill if vendedor_id is NULL or the dummy default
  IF (NEW.vendedor_id IS NULL OR NEW.vendedor_id = _dummy_uuid) AND NEW.tenant_id IS NOT NULL THEN
    BEGIN
      NEW.vendedor_id := resolve_default_vendedor_id(NEW.tenant_id);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  -- Sync the legacy text field if empty
  IF (NEW.vendedor IS NULL OR NEW.vendedor = '' OR NEW.vendedor = 'Site') AND NEW.vendedor_id IS NOT NULL AND NEW.vendedor_id != _dummy_uuid THEN
    SELECT v.nome INTO NEW.vendedor
    FROM vendedores v
    WHERE v.id = NEW.vendedor_id
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;
