
-- =====================================================
-- P1 #3: Restrict public vendedores access
-- Create a secure RPC for anon that returns ONLY safe fields
-- Then replace the permissive anon SELECT policy
-- =====================================================

-- RPC for resolving vendedor tenant_id by code/slug (anon-safe)
CREATE OR REPLACE FUNCTION public.resolve_vendedor_public(
  _codigo text
)
RETURNS TABLE(id uuid, nome text, codigo text, slug text, tenant_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.id, v.nome, v.codigo, v.slug, v.tenant_id
  FROM vendedores v
  WHERE (v.codigo = _codigo OR v.slug = _codigo)
    AND v.ativo = true
  LIMIT 1;
$$;

-- Remove the overly permissive anon SELECT policy
DROP POLICY IF EXISTS "vendedores_select_anon_scoped" ON public.vendedores;

-- Replace with a much tighter policy: anon can ONLY see id, nome, codigo, slug
-- But since RLS can't restrict columns, we remove anon SELECT entirely
-- and force anon access through the RPC above
-- (No new anon SELECT policy = anon cannot query vendedores table directly)

-- =====================================================
-- P1 #5: Fix resolve_public_tenant_id for multi-tenant
-- Allow explicit tenant resolution via vendedor code
-- instead of failing on multiple active tenants
-- =====================================================

CREATE OR REPLACE FUNCTION public.resolve_public_tenant_id(_vendedor_code text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant uuid;
  _count integer;
BEGIN
  -- 1) If vendedor code provided, resolve via vendedor
  IF _vendedor_code IS NOT NULL AND TRIM(_vendedor_code) != '' THEN
    SELECT v.tenant_id INTO _tenant
    FROM vendedores v
    WHERE (v.codigo = _vendedor_code OR v.slug = _vendedor_code)
      AND v.ativo = true
    LIMIT 1;
    
    IF _tenant IS NOT NULL THEN
      RETURN _tenant;
    END IF;
  END IF;

  -- 2) Fallback: single active tenant
  SELECT COUNT(*) INTO _count FROM tenants WHERE ativo = true;

  IF _count = 0 THEN
    RAISE EXCEPTION 'resolve_public_tenant_id: nenhum tenant ativo encontrado'
      USING ERRCODE = 'P0402';
  END IF;

  IF _count > 1 THEN
    RAISE EXCEPTION 'resolve_public_tenant_id: múltiplos tenants ativos (%). Use vendedor code para resolver.', _count
      USING ERRCODE = 'P0402';
  END IF;

  SELECT id INTO _tenant FROM tenants WHERE ativo = true LIMIT 1;
  RETURN _tenant;
END;
$$;
