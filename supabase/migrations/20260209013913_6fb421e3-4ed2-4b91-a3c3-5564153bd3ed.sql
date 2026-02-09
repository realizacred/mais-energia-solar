-- Tabela de avaliações de satisfação do atendimento WhatsApp
CREATE TABLE public.wa_satisfaction_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  conversation_id UUID NOT NULL REFERENCES public.wa_conversations(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  attendant_user_id UUID,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  answered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_wa_satisfaction_conversation ON public.wa_satisfaction_ratings(conversation_id);
CREATE INDEX idx_wa_satisfaction_tenant ON public.wa_satisfaction_ratings(tenant_id);
CREATE INDEX idx_wa_satisfaction_attendant ON public.wa_satisfaction_ratings(attendant_user_id);

-- RLS
ALTER TABLE public.wa_satisfaction_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view satisfaction ratings"
  ON public.wa_satisfaction_ratings FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Authenticated users can insert satisfaction ratings"
  ON public.wa_satisfaction_ratings FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Authenticated users can update satisfaction ratings"
  ON public.wa_satisfaction_ratings FOR UPDATE
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Service role also needs access (for webhook processing)
CREATE POLICY "Service role full access to satisfaction ratings"
  ON public.wa_satisfaction_ratings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
