-- Tabela de logs de resolução de conversas WhatsApp
CREATE TABLE public.wa_conversation_resolution_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  conversation_id UUID NOT NULL,
  status TEXT NOT NULL,
  matched_entity_type TEXT,
  matched_entity_id UUID,
  phone_raw TEXT,
  phone_variants JSONB,
  reason TEXT,
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_resolution_logs_tenant ON public.wa_conversation_resolution_logs(tenant_id, created_at DESC);
CREATE INDEX idx_wa_resolution_logs_conv ON public.wa_conversation_resolution_logs(conversation_id);

ALTER TABLE public.wa_conversation_resolution_logs ENABLE ROW LEVEL SECURITY;

-- SELECT: usuários do mesmo tenant
CREATE POLICY "wa_resolution_logs_select_tenant"
ON public.wa_conversation_resolution_logs FOR SELECT
USING (
  tenant_id = (
    SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid()
  )
);

-- INSERT: enforce tenant_id via profile
CREATE POLICY "wa_resolution_logs_insert_tenant"
ON public.wa_conversation_resolution_logs FOR INSERT
WITH CHECK (
  tenant_id = (
    SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid()
  )
);