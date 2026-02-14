
-- ============================================================
-- SEGURANÇA: Substituir leitura pública direta de tenants
-- por RPC segura que expõe apenas campos não-sensíveis
-- ============================================================

-- 1) DROPAR a policy pública que expõe TODAS as colunas
DROP POLICY IF EXISTS "Public read active tenants" ON public.tenants;

-- 2) CRIAR RPC pública segura (SECURITY DEFINER)
--    Retorna APENAS: id, nome, slug, status
--    Busca por slug (principal) ou id (opcional)
--    Somente tenants com status = 'active'
CREATE OR REPLACE FUNCTION public.resolve_tenant_public(
  _slug TEXT DEFAULT NULL,
  _id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  nome TEXT,
  slug TEXT,
  status TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT t.id, t.nome, t.slug, t.status::text
  FROM public.tenants t
  WHERE t.status = 'active'
    AND t.deleted_at IS NULL
    AND (
      (_slug IS NOT NULL AND t.slug = _slug)
      OR (_id IS NOT NULL AND t.id = _id)
      -- Se ambos NULL, retorna todos os ativos (para resolve_public_tenant_id fallback)
      OR (_slug IS NULL AND _id IS NULL)
    )
  LIMIT 10;
$$;

-- 3) GRANTS para anon e authenticated
GRANT EXECUTE ON FUNCTION public.resolve_tenant_public(TEXT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_tenant_public(TEXT, UUID) TO authenticated;

-- 4) Remover trigger de auditoria duplicado (cleanup)
DROP TRIGGER IF EXISTS audit_tenants_trigger ON public.tenants;
