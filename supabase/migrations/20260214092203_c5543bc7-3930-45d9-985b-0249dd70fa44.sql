
-- ============================================================
-- GERADOR DE PROPOSTA NATIVA — Lei 14.300 (Grupo A / Grupo B)
-- ============================================================

-- 1) ENUM
DO $$ BEGIN
  CREATE TYPE public.proposta_nativa_status AS ENUM (
    'draft', 'generated', 'sent', 'accepted', 'rejected', 'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2) proposta_templates
CREATE TABLE IF NOT EXISTS public.proposta_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  nome TEXT NOT NULL,
  descricao TEXT,
  grupo TEXT NOT NULL DEFAULT 'B' CHECK (grupo IN ('A', 'B', 'universal')),
  template_html TEXT,
  variaveis_disponiveis JSONB NOT NULL DEFAULT '[]'::jsonb,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.proposta_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own tenant templates"
  ON public.proposta_templates FOR SELECT
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "Admins insert templates"
  ON public.proposta_templates FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "Admins update templates"
  ON public.proposta_templates FOR UPDATE
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "Admins delete templates"
  ON public.proposta_templates FOR DELETE
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

CREATE INDEX idx_proposta_templates_tenant ON public.proposta_templates(tenant_id);
CREATE INDEX idx_proposta_templates_ativo ON public.proposta_templates(tenant_id, ativo) WHERE ativo = true;

CREATE TRIGGER update_proposta_templates_updated_at
  BEFORE UPDATE ON public.proposta_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER audit_proposta_templates
  AFTER INSERT OR UPDATE OR DELETE ON public.proposta_templates FOR EACH ROW EXECUTE FUNCTION audit_log_trigger_fn();

-- 3) propostas_nativas
CREATE TABLE IF NOT EXISTS public.propostas_nativas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  lead_id UUID REFERENCES public.leads(id),
  cliente_id UUID REFERENCES public.clientes(id),
  projeto_id UUID REFERENCES public.projetos(id),
  consultor_id UUID REFERENCES public.consultores(id),
  template_id UUID REFERENCES public.proposta_templates(id),
  titulo TEXT NOT NULL,
  codigo TEXT,
  versao_atual INTEGER NOT NULL DEFAULT 1,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.propostas_nativas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own tenant proposals"
  ON public.propostas_nativas FOR SELECT
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "Users insert proposals"
  ON public.propostas_nativas FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "Users update proposals"
  ON public.propostas_nativas FOR UPDATE
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active())
  WITH CHECK (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "Admins delete proposals"
  ON public.propostas_nativas FOR DELETE
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

CREATE INDEX idx_propostas_nativas_tenant ON public.propostas_nativas(tenant_id);
CREATE INDEX idx_propostas_nativas_lead ON public.propostas_nativas(tenant_id, lead_id);
CREATE INDEX idx_propostas_nativas_projeto ON public.propostas_nativas(tenant_id, projeto_id);
CREATE INDEX idx_propostas_nativas_cliente ON public.propostas_nativas(tenant_id, cliente_id);
CREATE INDEX idx_propostas_nativas_created ON public.propostas_nativas(tenant_id, created_at DESC);

CREATE TRIGGER update_propostas_nativas_updated_at
  BEFORE UPDATE ON public.propostas_nativas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER audit_propostas_nativas
  AFTER INSERT OR UPDATE OR DELETE ON public.propostas_nativas FOR EACH ROW EXECUTE FUNCTION audit_log_trigger_fn();

-- 4) proposta_versoes (com snapshot JSONB imutável)
CREATE TABLE IF NOT EXISTS public.proposta_versoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  proposta_id UUID NOT NULL REFERENCES public.propostas_nativas(id) ON DELETE CASCADE,
  versao_numero INTEGER NOT NULL,
  status public.proposta_nativa_status NOT NULL DEFAULT 'draft',
  grupo TEXT CHECK (grupo IN ('A', 'B')),
  potencia_kwp NUMERIC(8,2),
  valor_total NUMERIC(12,2),
  economia_mensal NUMERIC(10,2),
  payback_meses INTEGER,
  validade_dias INTEGER NOT NULL DEFAULT 30,
  valido_ate DATE,
  snapshot JSONB,
  observacoes TEXT,
  gerado_por UUID,
  gerado_em TIMESTAMPTZ,
  aceito_em TIMESTAMPTZ,
  rejeitado_em TIMESTAMPTZ,
  motivo_rejeicao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_proposta_versao UNIQUE (proposta_id, versao_numero)
);
ALTER TABLE public.proposta_versoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own tenant versions"
  ON public.proposta_versoes FOR SELECT
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "Users insert versions"
  ON public.proposta_versoes FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "Users update versions"
  ON public.proposta_versoes FOR UPDATE
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active())
  WITH CHECK (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "Admins delete versions"
  ON public.proposta_versoes FOR DELETE
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

CREATE INDEX idx_proposta_versoes_tenant ON public.proposta_versoes(tenant_id);
CREATE INDEX idx_proposta_versoes_proposta ON public.proposta_versoes(proposta_id, versao_numero DESC);
CREATE INDEX idx_proposta_versoes_status ON public.proposta_versoes(tenant_id, status);

CREATE TRIGGER update_proposta_versoes_updated_at
  BEFORE UPDATE ON public.proposta_versoes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER audit_proposta_versoes
  AFTER INSERT OR UPDATE OR DELETE ON public.proposta_versoes FOR EACH ROW EXECUTE FUNCTION audit_log_trigger_fn();

-- 5) proposta_renders
CREATE TABLE IF NOT EXISTS public.proposta_renders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  versao_id UUID NOT NULL REFERENCES public.proposta_versoes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('pdf', 'html', 'link')),
  url TEXT,
  storage_path TEXT,
  tamanho_bytes BIGINT,
  gerado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.proposta_renders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own tenant renders"
  ON public.proposta_renders FOR SELECT
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "System insert renders"
  ON public.proposta_renders FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE INDEX idx_proposta_renders_versao ON public.proposta_renders(versao_id);
CREATE INDEX idx_proposta_renders_tenant ON public.proposta_renders(tenant_id);

-- 6) proposta_envios
CREATE TABLE IF NOT EXISTS public.proposta_envios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  versao_id UUID NOT NULL REFERENCES public.proposta_versoes(id),
  canal TEXT NOT NULL CHECK (canal IN ('whatsapp', 'email', 'link', 'manual')),
  destinatario TEXT,
  enviado_por UUID,
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'enviado' CHECK (status IN ('enviado', 'entregue', 'lido', 'erro')),
  detalhes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.proposta_envios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own tenant sends"
  ON public.proposta_envios FOR SELECT
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "Users insert sends"
  ON public.proposta_envios FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id() AND tenant_and_user_active());

CREATE INDEX idx_proposta_envios_versao ON public.proposta_envios(versao_id);
CREATE INDEX idx_proposta_envios_tenant ON public.proposta_envios(tenant_id, enviado_em DESC);

CREATE TRIGGER audit_proposta_envios
  AFTER INSERT OR UPDATE OR DELETE ON public.proposta_envios FOR EACH ROW EXECUTE FUNCTION audit_log_trigger_fn();
