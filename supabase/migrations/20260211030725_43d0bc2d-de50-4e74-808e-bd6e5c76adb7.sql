CREATE OR REPLACE FUNCTION public.check_phone_duplicate(_telefone text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  normalized text;
  found boolean;
  _tenant_id uuid;
BEGIN
  normalized := regexp_replace(_telefone, '[^0-9]', '', 'g');
  
  -- Resolve tenant: authenticated user first, then public fallback
  _tenant_id := get_user_tenant_id();
  IF _tenant_id IS NULL THEN
    _tenant_id := resolve_public_tenant_id();
  END IF;
  
  SELECT EXISTS(
    SELECT 1 FROM leads
    WHERE tenant_id = _tenant_id
      AND (telefone_normalized = normalized
        OR regexp_replace(telefone, '[^0-9]', '', 'g') = normalized)
  ) INTO found;
  
  RETURN found;
END;
$function$;