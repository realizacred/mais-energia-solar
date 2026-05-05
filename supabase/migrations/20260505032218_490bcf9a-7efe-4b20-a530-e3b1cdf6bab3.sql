-- ═══════════════════════════════════════════════
-- recibos_emitidos: emissão de recibos a partir de document_templates
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.recibos_emitidos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT public.get_user_tenant_id(),
  template_id UUID NOT NULL REFERENCES public.document_templates(id) ON DELETE RESTRICT,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  projeto_id UUID REFERENCES public.projetos(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  numero TEXT,
  descricao TEXT,
  valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  dados_preenchidos JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'emitido',
  pdf_path TEXT,
  emitido_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID DEFAULT auth.uid(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID DEFAULT auth.uid(),
  CONSTRAINT recibos_emitidos_status_chk CHECK (status IN ('emitido','enviado','assinado','cancelado'))
);

CREATE INDEX IF NOT EXISTS idx_recibos_emitidos_tenant ON public.recibos_emitidos(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_recibos_emitidos_cliente ON public.recibos_emitidos(cliente_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_recibos_emitidos_projeto ON public.recibos_emitidos(projeto_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_recibos_emitidos_deal ON public.recibos_emitidos(deal_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_recibos_emitidos_created ON public.recibos_emitidos(created_at DESC);

ALTER TABLE public.recibos_emitidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant select recibos_emitidos"
  ON public.recibos_emitidos FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant insert recibos_emitidos"
  ON public.recibos_emitidos FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant update recibos_emitidos"
  ON public.recibos_emitidos FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant delete recibos_emitidos"
  ON public.recibos_emitidos FOR DELETE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- updated_at trigger (reuse public.update_updated_at_column if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'CREATE TRIGGER trg_recibos_emitidos_updated_at
             BEFORE UPDATE ON public.recibos_emitidos
             FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
  END IF;
END$$;

-- ═══════════════════════════════════════════════
-- Bucket privado: recibos
-- ═══════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public)
VALUES ('recibos', 'recibos', false)
ON CONFLICT (id) DO NOTHING;

-- Policies sobre storage.objects (path: {tenant_id}/{recibo_id}.pdf)
CREATE POLICY "Tenant read recibos bucket"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'recibos'
    AND (storage.foldername(name))[1] = public.get_user_tenant_id(auth.uid())::text
  );

CREATE POLICY "Tenant insert recibos bucket"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'recibos'
    AND (storage.foldername(name))[1] = public.get_user_tenant_id(auth.uid())::text
  );

CREATE POLICY "Tenant update recibos bucket"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'recibos'
    AND (storage.foldername(name))[1] = public.get_user_tenant_id(auth.uid())::text
  );

CREATE POLICY "Tenant delete recibos bucket"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'recibos'
    AND (storage.foldername(name))[1] = public.get_user_tenant_id(auth.uid())::text
  );