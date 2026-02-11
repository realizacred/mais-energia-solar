
-- ============================================================
-- FASE 1: resolve_default_vendedor_id — Resolve fallback vendor
-- ============================================================

CREATE OR REPLACE FUNCTION public.resolve_default_vendedor_id(_tenant_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _vendedor_id uuid;
BEGIN
  -- 1) Try to find vendedor linked to first admin of this tenant
  SELECT v.id INTO _vendedor_id
  FROM user_roles ur
  JOIN profiles p ON p.user_id = ur.user_id
  JOIN vendedores v ON v.user_id = ur.user_id AND v.tenant_id = _tenant_id AND v.ativo = true
  WHERE ur.role::text = 'admin'
    AND p.tenant_id = _tenant_id
  ORDER BY v.created_at ASC
  LIMIT 1;

  IF _vendedor_id IS NOT NULL THEN
    RETURN _vendedor_id;
  END IF;

  -- 2) Fallback: first active vendedor of the tenant
  SELECT v.id INTO _vendedor_id
  FROM vendedores v
  WHERE v.tenant_id = _tenant_id AND v.ativo = true
  ORDER BY v.created_at ASC
  LIMIT 1;

  IF _vendedor_id IS NOT NULL THEN
    RETURN _vendedor_id;
  END IF;

  -- 3) Last resort: raise exception (tenant has no vendedores)
  RAISE EXCEPTION 'resolve_default_vendedor_id: nenhum vendedor ativo encontrado para tenant=%', _tenant_id
    USING ERRCODE = 'P0402';
END;
$$;

-- ============================================================
-- FASE 2: Trigger BEFORE INSERT — auto-fill vendedor_id if NULL
-- ============================================================

CREATE OR REPLACE FUNCTION public.resolve_lead_vendedor_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only fill if vendedor_id is NULL and tenant_id is resolved
  IF NEW.vendedor_id IS NULL AND NEW.tenant_id IS NOT NULL THEN
    BEGIN
      NEW.vendedor_id := resolve_default_vendedor_id(NEW.tenant_id);
    EXCEPTION WHEN OTHERS THEN
      -- If no vendedor found, let it pass (NOT NULL will catch it later)
      NULL;
    END;
  END IF;

  -- Also sync the legacy text field if empty
  IF (NEW.vendedor IS NULL OR NEW.vendedor = '' OR NEW.vendedor = 'Site') AND NEW.vendedor_id IS NOT NULL THEN
    SELECT v.nome INTO NEW.vendedor
    FROM vendedores v
    WHERE v.id = NEW.vendedor_id
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lead_resolve_vendedor_id
BEFORE INSERT ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.resolve_lead_vendedor_id();

-- ============================================================
-- FASE 3: Backfill existing leads with NULL vendedor_id
-- ============================================================

UPDATE leads
SET vendedor_id = resolve_default_vendedor_id(tenant_id),
    vendedor = COALESCE(vendedor, (
      SELECT v.nome FROM vendedores v WHERE v.id = resolve_default_vendedor_id(leads.tenant_id) LIMIT 1
    ))
WHERE vendedor_id IS NULL AND tenant_id IS NOT NULL;

-- ============================================================
-- FASE 4: SET NOT NULL on vendedor_id
-- ============================================================

ALTER TABLE public.leads ALTER COLUMN vendedor_id SET NOT NULL;

-- ============================================================
-- FASE 5: Update RLS policy to use vendedor_id instead of text
-- ============================================================

-- Drop the old text-based policy
DROP POLICY IF EXISTS rls_leads_select_vendedor ON public.leads;

-- Create new policy using vendedor_id (proper FK-based visibility)
CREATE POLICY rls_leads_select_vendedor ON public.leads
FOR SELECT
TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  AND vendedor_id IN (
    SELECT v.id FROM vendedores v
    WHERE v.user_id = auth.uid()
      AND v.tenant_id = get_user_tenant_id()
      AND v.ativo = true
  )
);
