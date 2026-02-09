-- Tabela de categorias de respostas rápidas do WhatsApp
CREATE TABLE public.wa_quick_reply_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) DEFAULT (get_user_tenant_id()),
  nome TEXT NOT NULL,
  slug TEXT NOT NULL,
  cor TEXT NOT NULL DEFAULT 'bg-muted text-muted-foreground',
  emoji TEXT DEFAULT '💬',
  ordem INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique slug per tenant
CREATE UNIQUE INDEX idx_wa_qr_categories_slug ON public.wa_quick_reply_categories(tenant_id, slug);

-- RLS
ALTER TABLE public.wa_quick_reply_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage categories"
ON public.wa_quick_reply_categories
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated users can read categories"
ON public.wa_quick_reply_categories
FOR SELECT
TO authenticated
USING (true);

-- Trigger updated_at
CREATE TRIGGER update_wa_qr_categories_updated_at
BEFORE UPDATE ON public.wa_quick_reply_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default categories
INSERT INTO public.wa_quick_reply_categories (nome, slug, cor, emoji, ordem) VALUES
  ('Geral', 'geral', 'bg-muted text-muted-foreground', '💬', 0),
  ('Saudação', 'saudacao', 'bg-success/10 text-success', '👋', 1),
  ('Orçamento', 'orcamento', 'bg-primary/10 text-primary', '📋', 2),
  ('Follow-up', 'followup', 'bg-warning/10 text-warning', '🔄', 3),
  ('Financiamento', 'financiamento', 'bg-info/10 text-info', '💰', 4),
  ('Técnico', 'tecnico', 'bg-accent text-accent-foreground', '🔧', 5),
  ('Encerramento', 'encerramento', 'bg-destructive/10 text-destructive', '🏁', 6);

COMMENT ON TABLE public.wa_quick_reply_categories IS 'Categorias dinâmicas para respostas rápidas do WhatsApp';