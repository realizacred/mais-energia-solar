
CREATE OR REPLACE FUNCTION public.validate_projeto_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
BEGIN
  -- Skip validation if cliente_id is NULL
  IF NEW.cliente_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT tenant_id INTO v_tenant FROM public.clientes WHERE id = NEW.cliente_id;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Cliente % não encontrado', NEW.cliente_id;
  END IF;
  IF v_tenant <> NEW.tenant_id THEN
    RAISE EXCEPTION 'Cliente % pertence a outro tenant', NEW.cliente_id;
  END IF;
  RETURN NEW;
END;
$$;
