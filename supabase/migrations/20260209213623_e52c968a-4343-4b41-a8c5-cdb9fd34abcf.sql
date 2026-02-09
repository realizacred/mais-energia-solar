
-- ============================================================
-- vendor_invites: Convites de ativação para vendedores
-- ============================================================
CREATE TABLE public.vendor_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  vendedor_id UUID NOT NULL REFERENCES public.vendedores(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '48 hours'),
  used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast token lookup
CREATE INDEX idx_vendor_invites_token ON public.vendor_invites(token) WHERE used_at IS NULL AND revoked_at IS NULL;
CREATE INDEX idx_vendor_invites_vendedor ON public.vendor_invites(vendedor_id);

-- Enable RLS
ALTER TABLE public.vendor_invites ENABLE ROW LEVEL SECURITY;

-- Admins of same tenant can manage invites
CREATE POLICY "Admins can manage vendor invites"
  ON public.vendor_invites
  FOR ALL
  USING (
    public.is_admin(auth.uid()) AND
    tenant_id = public.get_user_tenant_id()
  )
  WITH CHECK (
    public.is_admin(auth.uid()) AND
    tenant_id = public.get_user_tenant_id()
  );

-- Audit trigger
CREATE TRIGGER audit_vendor_invites
  AFTER INSERT OR UPDATE OR DELETE ON public.vendor_invites
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger_fn();

-- ============================================================
-- resolve_phone_to_email: lookup email by phone for login
-- ============================================================
CREATE OR REPLACE FUNCTION public.resolve_phone_to_email(_phone text)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _normalized text;
  _email text;
BEGIN
  _normalized := regexp_replace(_phone, '[^0-9]', '', 'g');

  -- Look up vendedor by phone, get linked auth user's email
  SELECT u.email INTO _email
  FROM vendedores v
  JOIN auth.users u ON u.id = v.user_id
  WHERE regexp_replace(v.telefone, '[^0-9]', '', 'g') = _normalized
    AND v.ativo = true
    AND v.user_id IS NOT NULL
  LIMIT 1;

  -- Also check profiles if not found via vendedores
  IF _email IS NULL THEN
    SELECT u.email INTO _email
    FROM profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE p.telefone IS NOT NULL
      AND regexp_replace(p.telefone, '[^0-9]', '', 'g') = _normalized
      AND p.ativo = true
    LIMIT 1;
  END IF;

  RETURN _email;
END;
$$;
