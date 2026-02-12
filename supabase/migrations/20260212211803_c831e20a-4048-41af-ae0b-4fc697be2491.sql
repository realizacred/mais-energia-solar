
-- Fix ambiguous resolve_public_tenant_id() calls in find_leads_by_phone and check_phone_duplicate
-- by casting to the no-arg signature explicitly

CREATE OR REPLACE FUNCTION public.find_leads_by_phone(_telefone text)
RETURNS TABLE(id uuid, lead_code text, nome text, telefone text, telefone_normalized text, created_at timestamptz, updated_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized text;
  _tenant_id uuid;
BEGIN
  normalized := regexp_replace(_telefone, '[^0-9]', '', 'g');
  
  -- Resolve tenant
  _tenant_id := get_user_tenant_id();
  IF _tenant_id IS NULL THEN
    _tenant_id := resolve_public_tenant_id(NULL::text);
  END IF;
  
  RETURN QUERY
  SELECT l.id, l.lead_code, l.nome, l.telefone, l.telefone_normalized, l.created_at, l.updated_at
  FROM leads l
  WHERE l.tenant_id = _tenant_id
    AND (l.telefone_normalized = normalized
      OR regexp_replace(l.telefone, '[^0-9]', '', 'g') = normalized)
  ORDER BY l.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_phone_duplicate(_telefone text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized text;
  found boolean;
  _tenant_id uuid;
BEGIN
  normalized := regexp_replace(_telefone, '[^0-9]', '', 'g');
  
  _tenant_id := get_user_tenant_id();
  IF _tenant_id IS NULL THEN
    _tenant_id := resolve_public_tenant_id(NULL::text);
  END IF;
  
  SELECT EXISTS(
    SELECT 1 FROM leads
    WHERE tenant_id = _tenant_id
      AND (telefone_normalized = normalized
        OR regexp_replace(telefone, '[^0-9]', '', 'g') = normalized)
  ) INTO found;
  
  RETURN found;
END;
$$;
