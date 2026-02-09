-- Table for dynamic quick reply templates (respostas rápidas)
CREATE TABLE public.wa_quick_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id),
  titulo TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  emoji TEXT DEFAULT '💬',
  categoria TEXT DEFAULT 'geral',
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('image', 'video', 'audio', 'document', NULL)),
  media_filename TEXT,
  ordem INT DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wa_quick_replies ENABLE ROW LEVEL SECURITY;

-- RLS: admin and vendedores can read active replies
CREATE POLICY "Authenticated users can read quick replies"
  ON public.wa_quick_replies FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- RLS: admins can manage quick replies
CREATE POLICY "Admins can insert quick replies"
  ON public.wa_quick_replies FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update quick replies"
  ON public.wa_quick_replies FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete quick replies"
  ON public.wa_quick_replies FOR DELETE
  USING (public.is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_wa_quick_replies_updated_at
  BEFORE UPDATE ON public.wa_quick_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index
CREATE INDEX idx_wa_quick_replies_active ON public.wa_quick_replies (ativo, ordem);