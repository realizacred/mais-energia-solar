
-- ═══════════════════════════════════════════════════════
-- MODULE: Documentos Inteligentes & Assinatura Eletrônica
-- ═══════════════════════════════════════════════════════

-- A) document_templates
CREATE TABLE public.document_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  categoria TEXT NOT NULL DEFAULT 'contrato',
  subcategoria TEXT,
  nome TEXT NOT NULL,
  descricao TEXT,
  docx_storage_path TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  requires_signature_default BOOLEAN NOT NULL DEFAULT false,
  default_signers JSONB DEFAULT '[]'::jsonb,
  form_schema JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_document_templates_tenant ON public.document_templates(tenant_id);
CREATE INDEX idx_document_templates_categoria ON public.document_templates(tenant_id, categoria);

ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON public.document_templates
  FOR SELECT USING (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_isolation_insert" ON public.document_templates
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_isolation_update" ON public.document_templates
  FOR UPDATE USING (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_isolation_delete" ON public.document_templates
  FOR DELETE USING (tenant_id = get_user_tenant_id());

CREATE TRIGGER update_document_templates_updated_at
  BEFORE UPDATE ON public.document_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- B) generated_documents
CREATE TABLE public.generated_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  deal_id UUID REFERENCES public.deals(id),
  lead_id UUID REFERENCES public.leads(id),
  projeto_id UUID REFERENCES public.projetos(id),
  cliente_id UUID REFERENCES public.clientes(id),
  template_id UUID NOT NULL REFERENCES public.document_templates(id),
  template_version INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'sent_for_signature', 'signed', 'cancelled')),
  input_payload JSONB DEFAULT '{}'::jsonb,
  docx_filled_path TEXT,
  pdf_path TEXT,
  signature_provider TEXT,
  envelope_id TEXT,
  signature_status TEXT,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_generated_documents_tenant ON public.generated_documents(tenant_id);
CREATE INDEX idx_generated_documents_deal ON public.generated_documents(deal_id);
CREATE INDEX idx_generated_documents_template ON public.generated_documents(template_id);

ALTER TABLE public.generated_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON public.generated_documents
  FOR SELECT USING (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_isolation_insert" ON public.generated_documents
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_isolation_update" ON public.generated_documents
  FOR UPDATE USING (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_isolation_delete" ON public.generated_documents
  FOR DELETE USING (tenant_id = get_user_tenant_id());

CREATE TRIGGER update_generated_documents_updated_at
  BEFORE UPDATE ON public.generated_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- C) signature_settings (one per tenant)
CREATE TABLE public.signature_settings (
  tenant_id UUID NOT NULL PRIMARY KEY REFERENCES public.tenants(id),
  enabled BOOLEAN NOT NULL DEFAULT false,
  provider TEXT DEFAULT 'zapsign',
  api_token_encrypted TEXT,
  sandbox_mode BOOLEAN NOT NULL DEFAULT true,
  webhook_secret_encrypted TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.signature_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON public.signature_settings
  FOR SELECT USING (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_isolation_insert" ON public.signature_settings
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_isolation_update" ON public.signature_settings
  FOR UPDATE USING (tenant_id = get_user_tenant_id());

CREATE TRIGGER update_signature_settings_updated_at
  BEFORE UPDATE ON public.signature_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- D) signers
CREATE TABLE public.signers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  auth_method TEXT NOT NULL DEFAULT 'email' CHECK (auth_method IN ('email', 'whatsapp', 'sms')),
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  cpf TEXT,
  birth_date DATE,
  phone TEXT,
  options JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_signers_tenant ON public.signers(tenant_id);

ALTER TABLE public.signers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON public.signers
  FOR SELECT USING (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_isolation_insert" ON public.signers
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_isolation_update" ON public.signers
  FOR UPDATE USING (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_isolation_delete" ON public.signers
  FOR DELETE USING (tenant_id = get_user_tenant_id());

CREATE TRIGGER update_signers_updated_at
  BEFORE UPDATE ON public.signers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for document templates and generated files
INSERT INTO storage.buckets (id, name, public) VALUES ('document-files', 'document-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: tenant-scoped paths
CREATE POLICY "tenant_upload_documents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'document-files'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = get_user_tenant_id()::text
  );

CREATE POLICY "tenant_read_documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'document-files'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = get_user_tenant_id()::text
  );

CREATE POLICY "tenant_delete_documents" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'document-files'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = get_user_tenant_id()::text
  );
