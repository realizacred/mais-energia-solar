-- Table: configurable checklist items per tenant
CREATE TABLE public.doc_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  label text NOT NULL,
  icon text DEFAULT '📄',
  obrigatorio boolean NOT NULL DEFAULT false,
  aceita_arquivo boolean NOT NULL DEFAULT false,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: per-deal checklist status
CREATE TABLE public.doc_checklist_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.doc_checklist_items(id) ON DELETE CASCADE,
  concluido boolean NOT NULL DEFAULT false,
  arquivo_path text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id(),
  UNIQUE(deal_id, item_id)
);

-- Indexes
CREATE INDEX idx_doc_checklist_items_tenant ON public.doc_checklist_items(tenant_id, ativo, ordem);
CREATE INDEX idx_doc_checklist_status_deal ON public.doc_checklist_status(deal_id);

-- RLS
ALTER TABLE public.doc_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doc_checklist_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.doc_checklist_items
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant isolation" ON public.doc_checklist_status
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- Seed default items for all existing tenants
INSERT INTO public.doc_checklist_items (tenant_id, label, icon, obrigatorio, aceita_arquivo, ordem)
SELECT t.id, item.label, item.icon, item.obrigatorio, item.aceita_arquivo, item.ordem
FROM public.tenants t
CROSS JOIN (VALUES
  ('RG/CNH dos Proprietários', '🪪', true, true, 1),
  ('Conta de Luz (Última fatura)', '⚡', true, true, 2),
  ('IPTU/Documento do Imóvel', '🏠', false, true, 3),
  ('Fotos (Telhado, Padrão, Quadro)', '📷', true, true, 4),
  ('Autorização Concessionária (ART)', '📋', false, true, 5),
  ('Contrato Assinado', '✍️', true, false, 6)
) AS item(label, icon, obrigatorio, aceita_arquivo, ordem);