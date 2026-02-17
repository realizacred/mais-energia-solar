
-- =====================================================
-- SECURITY HARDENING: Deterministic tenant resolution
-- Fix: drop parameterized version explicitly before recreating
-- =====================================================

-- Drop BOTH overloads of resolve_public_tenant_id
DROP FUNCTION IF EXISTS public.resolve_public_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS public.resolve_public_tenant_id(text) CASCADE;

-- Recreate ONLY the strict parameterized version (no default)
CREATE OR REPLACE FUNCTION public.resolve_public_tenant_id(_consultor_code text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _tenant uuid;
BEGIN
  IF _consultor_code IS NULL OR TRIM(_consultor_code) = '' THEN
    RAISE EXCEPTION 'resolve_public_tenant_id: consultor_code is REQUIRED. Implicit tenant resolution is FORBIDDEN.'
      USING ERRCODE = 'P0402';
  END IF;

  SELECT v.tenant_id INTO _tenant
  FROM consultores v
  WHERE (v.codigo = _consultor_code OR v.slug = _consultor_code)
    AND v.ativo = true
  LIMIT 1;

  IF _tenant IS NULL THEN
    RAISE EXCEPTION 'resolve_public_tenant_id: no active consultor for code "%"', _consultor_code
      USING ERRCODE = 'P0404';
  END IF;

  RETURN _tenant;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_public_tenant_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_public_tenant_id(text) TO authenticated, service_role;

-- ═══════════════════════════════════════════════════════
-- FAIL-SAFE TRIGGERS
-- ═══════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.resolve_lead_tenant_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _resolved uuid;
BEGIN
  IF NEW.tenant_id IS NOT NULL THEN RETURN NEW; END IF;

  IF auth.uid() IS NOT NULL THEN
    _resolved := get_user_tenant_id();
    IF _resolved IS NOT NULL THEN
      NEW.tenant_id := _resolved;
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.consultor_id IS NOT NULL THEN
    SELECT v.tenant_id INTO _resolved
    FROM consultores v WHERE v.id = NEW.consultor_id AND v.ativo = true;
    IF _resolved IS NOT NULL THEN
      NEW.tenant_id := _resolved;
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'resolve_lead_tenant_id: tenant_id could not be determined. Implicit resolution FORBIDDEN.'
    USING ERRCODE = 'P0402';
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_sim_tenant_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.tenant_id IS NOT NULL THEN RETURN NEW; END IF;

  IF auth.uid() IS NOT NULL THEN
    NEW.tenant_id := get_user_tenant_id();
    IF NEW.tenant_id IS NOT NULL THEN RETURN NEW; END IF;
  END IF;

  RAISE EXCEPTION 'resolve_sim_tenant_id: tenant_id could not be determined. Implicit resolution FORBIDDEN.'
    USING ERRCODE = 'P0402';
END;
$$;

-- ═══════════════════════════════════════════════════════
-- FIX find_leads_by_phone & check_phone_duplicate: remove fallback
-- ═══════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.find_leads_by_phone(_telefone text)
RETURNS TABLE(id uuid, lead_code text, nome text, telefone text, telefone_normalized text, created_at timestamptz, updated_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  normalized text;
  _tenant_id uuid;
BEGIN
  normalized := regexp_replace(_telefone, '[^0-9]', '', 'g');
  _tenant_id := get_user_tenant_id();
  IF _tenant_id IS NULL THEN RETURN; END IF;
  
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
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  normalized text;
  found boolean;
  _tenant_id uuid;
BEGIN
  normalized := regexp_replace(_telefone, '[^0-9]', '', 'g');
  _tenant_id := get_user_tenant_id();
  IF _tenant_id IS NULL THEN RETURN false; END IF;
  
  SELECT EXISTS(
    SELECT 1 FROM leads
    WHERE tenant_id = _tenant_id
      AND (telefone_normalized = normalized
        OR regexp_replace(telefone, '[^0-9]', '', 'g') = normalized)
  ) INTO found;
  
  RETURN found;
END;
$$;

-- ═══════════════════════════════════════════════════════
-- VALIDATE_CONSULTOR_CODE — Anti-enumeration + rate limit
-- ═══════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.validate_consultor_code(text) CASCADE;

CREATE OR REPLACE FUNCTION public.validate_consultor_code(_codigo text)
RETURNS TABLE(valid boolean, nome text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
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
$$;

REVOKE ALL ON FUNCTION public.validate_consultor_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_consultor_code(text) TO anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════
-- DEACTIVATE TENANT "Teste"
-- ═══════════════════════════════════════════════════════

UPDATE public.tenants
SET status = 'disabled', ativo = false, updated_at = now()
WHERE slug = 'teste' AND id = '58ac9830-845e-4bfd-9f2f-258be568ef14';
