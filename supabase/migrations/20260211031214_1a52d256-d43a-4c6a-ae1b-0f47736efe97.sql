-- RPC to find duplicate leads by phone across the entire tenant (bypasses RLS)
-- Returns only basic info needed for duplicate selection dialog
CREATE OR REPLACE FUNCTION public.find_leads_by_phone(_telefone text)
 RETURNS TABLE(id uuid, lead_code text, nome text, telefone text, telefone_normalized text, created_at timestamptz, updated_at timestamptz)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  normalized text;
  _tenant_id uuid;
BEGIN
  normalized := regexp_replace(_telefone, '[^0-9]', '', 'g');
  
  -- Resolve tenant
  _tenant_id := get_user_tenant_id();
  IF _tenant_id IS NULL THEN
    _tenant_id := resolve_public_tenant_id();
  END IF;
  
  RETURN QUERY
  SELECT l.id, l.lead_code, l.nome, l.telefone, l.telefone_normalized, l.created_at, l.updated_at
  FROM leads l
  WHERE l.tenant_id = _tenant_id
    AND (l.telefone_normalized = normalized
      OR regexp_replace(l.telefone, '[^0-9]', '', 'g') = normalized)
  ORDER BY l.created_at DESC;
END;
$function$;