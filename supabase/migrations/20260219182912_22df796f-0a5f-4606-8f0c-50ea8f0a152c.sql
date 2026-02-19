
-- ============================================================
-- 1. Proposta code: create sequence + trigger PROP-xxxx
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS public.proposta_code_seq START 1;

-- Set sequence to max existing numeric value
DO $$
DECLARE _max INT;
BEGIN
  SELECT COALESCE(MAX(
    CASE WHEN codigo ~ '^\D*(\d+)' THEN (regexp_replace(codigo, '^\D*(\d+).*', '\1'))::int ELSE 0 END
  ), 0) INTO _max FROM propostas_nativas;
  IF _max > 0 THEN
    PERFORM setval('public.proposta_code_seq', _max);
  END IF;
END$$;

CREATE OR REPLACE FUNCTION public.generate_proposta_code()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.codigo IS NULL OR NEW.codigo = '' THEN
    NEW.codigo := 'PROP-' || LPAD(nextval('public.proposta_code_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_generate_proposta_code ON propostas_nativas;
CREATE TRIGGER trg_generate_proposta_code
  BEFORE INSERT ON propostas_nativas
  FOR EACH ROW
  EXECUTE FUNCTION generate_proposta_code();

-- Backfill existing propostas with wrong format
UPDATE propostas_nativas
SET codigo = 'PROP-' || LPAD(nextval('public.proposta_code_seq')::TEXT, 4, '0')
WHERE codigo IS NULL OR codigo = '' OR codigo NOT LIKE 'PROP-%';
