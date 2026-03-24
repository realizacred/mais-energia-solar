
-- proposal_message_logs: histórico de envios de mensagens da proposta
CREATE TABLE public.proposal_message_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  proposta_id uuid NOT NULL,
  versao_id uuid NOT NULL,
  projeto_id uuid NOT NULL,
  cliente_id uuid,
  user_id uuid NOT NULL,
  tipo_mensagem text NOT NULL CHECK (tipo_mensagem IN ('cliente', 'consultor')),
  estilo text NOT NULL CHECK (estilo IN ('curta', 'completa')),
  canal text NOT NULL CHECK (canal IN ('whatsapp', 'email', 'copy')),
  destinatario_tipo text NOT NULL CHECK (destinatario_tipo IN ('cliente', 'consultor')),
  destinatario_valor text,
  conteudo text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  erro text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_proposal_message_logs_tenant ON public.proposal_message_logs(tenant_id);
CREATE INDEX idx_proposal_message_logs_proposta ON public.proposal_message_logs(proposta_id);
CREATE INDEX idx_proposal_message_logs_projeto ON public.proposal_message_logs(projeto_id);

-- RLS
ALTER TABLE public.proposal_message_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation select" ON public.proposal_message_logs
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant isolation insert" ON public.proposal_message_logs
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant isolation update" ON public.proposal_message_logs
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
