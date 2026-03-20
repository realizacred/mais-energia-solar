
-- Table for public access tokens to UCs (client portal links)
CREATE TABLE public.uc_client_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  unit_id UUID NOT NULL REFERENCES public.units_consumidoras(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL DEFAULT current_tenant_id() REFERENCES public.tenants(id),
  token TEXT NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex') UNIQUE,
  label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_accessed_at TIMESTAMPTZ
);

CREATE INDEX idx_uc_client_tokens_token ON public.uc_client_tokens(token) WHERE is_active = true;
CREATE INDEX idx_uc_client_tokens_unit ON public.uc_client_tokens(unit_id);

ALTER TABLE public.uc_client_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can manage tokens"
ON public.uc_client_tokens FOR ALL TO authenticated
USING (tenant_id = current_tenant_id())
WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "Anon can read active tokens"
ON public.uc_client_tokens FOR SELECT TO anon
USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- RPC to resolve token → UC + brand data (public, no auth)
CREATE OR REPLACE FUNCTION public.resolve_uc_client_token(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tok uc_client_tokens%ROWTYPE;
  v_uc units_consumidoras%ROWTYPE;
  v_tenant_name TEXT;
  v_brand JSON;
BEGIN
  SELECT * INTO v_tok FROM uc_client_tokens
  WHERE token = p_token AND is_active = true AND (expires_at IS NULL OR expires_at > now());
  IF NOT FOUND THEN RETURN json_build_object('error', 'invalid_token'); END IF;

  UPDATE uc_client_tokens SET last_accessed_at = now() WHERE id = v_tok.id;

  SELECT * INTO v_uc FROM units_consumidoras WHERE id = v_tok.unit_id;
  SELECT nome INTO v_tenant_name FROM tenants WHERE id = v_tok.tenant_id;

  SELECT json_build_object('logo_url', bs.logo_url, 'color_primary', bs.color_primary, 'company_name', v_tenant_name)
  INTO v_brand FROM brand_settings bs WHERE bs.tenant_id = v_tok.tenant_id LIMIT 1;

  RETURN json_build_object(
    'unit_id', v_uc.id, 'unit_name', v_uc.nome, 'codigo_uc', v_uc.codigo_uc,
    'concessionaria_nome', v_uc.concessionaria_nome, 'tipo_uc', v_uc.tipo_uc,
    'tenant_id', v_tok.tenant_id, 'brand', COALESCE(v_brand, '{}'::json)
  );
END;
$$;

-- Allow anon to call the RPC
GRANT EXECUTE ON FUNCTION public.resolve_uc_client_token(TEXT) TO anon;

-- Allow anon to read invoices for public UC pages
CREATE POLICY "Anon can read invoices via token context"
ON public.unit_invoices FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM uc_client_tokens t
    WHERE t.unit_id = unit_invoices.unit_id
      AND t.is_active = true
      AND (t.expires_at IS NULL OR t.expires_at > now())
  )
);
