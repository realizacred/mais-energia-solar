-- Fix: validate_consultor_code must be VOLATILE because check_rate_limit does INSERTs
CREATE OR REPLACE FUNCTION public.validate_consultor_code(_codigo text)
 RETURNS TABLE(valid boolean, nome text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _nome text;
  _found boolean;
BEGIN
  IF NOT check_rate_limit('validate_consultor_code', COALESCE(_codigo, 'empty'), 60, 20) THEN
    RETURN QUERY SELECT false, ''::text;
    RETURN;
  END IF;

  SELECT v.nome INTO _nome
  FROM consultores v
  WHERE (v.codigo = _codigo OR v.slug = _codigo)
    AND v.ativo = true
  LIMIT 1;

  _found := _nome IS NOT NULL;
  RETURN QUERY SELECT _found, COALESCE(_nome, ''::text);
END;
$function$;

-- Re-grant permissions
GRANT EXECUTE ON FUNCTION public.validate_consultor_code(text) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_consultor_code(text) TO authenticated;