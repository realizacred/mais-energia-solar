
-- =============================================
-- PHASE 6: Tracking, SMTP, Auto-Expiration
-- =============================================

-- 1) proposta_aceite_tokens (create if not exists from Phase 5)
CREATE TABLE IF NOT EXISTS public.proposta_aceite_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  proposta_id UUID NOT NULL REFERENCES propostas_nativas(id),
  versao_id UUID NOT NULL,
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_by UUID,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  used_at TIMESTAMPTZ,
  aceite_nome TEXT,
  aceite_documento TEXT,
  aceite_observacoes TEXT,
  aceite_ip TEXT,
  aceite_user_agent TEXT,
  assinatura_url TEXT,
  view_count INTEGER DEFAULT 0,
  first_viewed_at TIMESTAMPTZ,
  last_viewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE proposta_aceite_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant can view tokens"
ON proposta_aceite_tokens FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Tenant can insert tokens"
ON proposta_aceite_tokens FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Anyone can update tokens for acceptance"
ON proposta_aceite_tokens FOR UPDATE
USING (true);

CREATE POLICY "Anon can read tokens by token value"
ON proposta_aceite_tokens FOR SELECT
USING (true);

-- 2) Tracking de abertura
CREATE TABLE public.proposta_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  token_id UUID NOT NULL REFERENCES proposta_aceite_tokens(id),
  proposta_id UUID NOT NULL REFERENCES propostas_nativas(id),
  versao_id UUID NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposta_views_token ON proposta_views(token_id);
CREATE INDEX idx_proposta_views_proposta ON proposta_views(proposta_id);
CREATE INDEX idx_proposta_views_tenant ON proposta_views(tenant_id);

ALTER TABLE proposta_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view proposta_views"
ON proposta_views FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Anyone can insert proposta_views"
ON proposta_views FOR INSERT
WITH CHECK (true);

-- 3) SMTP config per tenant
CREATE TABLE public.tenant_smtp_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) UNIQUE,
  host TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 587,
  username TEXT NOT NULL,
  password_encrypted TEXT NOT NULL,
  from_email TEXT NOT NULL,
  from_name TEXT,
  use_tls BOOLEAN DEFAULT true,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tenant_smtp_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read smtp config"
ON tenant_smtp_config FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admin can insert smtp config"
ON tenant_smtp_config FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Admin can update smtp config"
ON tenant_smtp_config FOR UPDATE
USING (tenant_id = get_user_tenant_id());

CREATE TRIGGER update_tenant_smtp_config_updated_at
BEFORE UPDATE ON tenant_smtp_config
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4) Auto-expiration function
CREATE OR REPLACE FUNCTION public.expire_proposals()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE propostas_nativas pn
  SET status = 'expirada',
      updated_at = now()
  WHERE pn.status IN ('gerada', 'enviada', 'generated', 'sent')
    AND EXISTS (
      SELECT 1 FROM proposta_versoes pv
      WHERE pv.proposta_id = pn.id
        AND pv.valido_ate IS NOT NULL
        AND pv.valido_ate < now()
    );
END;
$$;

-- 5) Storage bucket for signatures
INSERT INTO storage.buckets (id, name, public)
VALUES ('proposal-signatures', 'proposal-signatures', true)
ON CONFLICT (id) DO NOTHING;
