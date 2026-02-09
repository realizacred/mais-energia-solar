
-- ============================================================
-- Follow-up Rules: regras configuráveis pelo admin
-- ============================================================
CREATE TABLE public.wa_followup_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  nome TEXT NOT NULL,
  descricao TEXT,
  -- Cenário: 'cliente_sem_resposta', 'equipe_sem_resposta', 'conversa_parada'
  cenario TEXT NOT NULL CHECK (cenario IN ('cliente_sem_resposta', 'equipe_sem_resposta', 'conversa_parada')),
  -- Prazo em horas para disparar o follow-up
  prazo_horas INTEGER NOT NULL DEFAULT 24,
  -- Prioridade: 'baixa', 'media', 'alta', 'urgente'
  prioridade TEXT NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa', 'media', 'alta', 'urgente')),
  -- Mensagem automática (se null, apenas alerta visual)
  mensagem_template TEXT,
  -- Enviar mensagem automática?
  envio_automatico BOOLEAN NOT NULL DEFAULT false,
  -- Máximo de follow-ups automáticos por conversa nesta regra
  max_tentativas INTEGER NOT NULL DEFAULT 3,
  -- Só aplicar a conversas com estes status (null = todos)
  status_conversa TEXT[] DEFAULT ARRAY['open'],
  -- Ativo/inativo
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wa_followup_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for wa_followup_rules"
  ON public.wa_followup_rules
  FOR ALL
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE TRIGGER update_wa_followup_rules_updated_at
  BEFORE UPDATE ON public.wa_followup_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Follow-up Queue: instâncias de follow-ups pendentes/enviados
-- ============================================================
CREATE TABLE public.wa_followup_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  rule_id UUID NOT NULL REFERENCES wa_followup_rules(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL,
  -- Status: 'pendente', 'enviado', 'respondido', 'cancelado', 'expirado'
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'enviado', 'respondido', 'cancelado', 'expirado')),
  tentativa INTEGER NOT NULL DEFAULT 1,
  -- Quando o follow-up deve ser disparado
  scheduled_at TIMESTAMPTZ NOT NULL,
  -- Quando foi efetivamente enviado
  sent_at TIMESTAMPTZ,
  -- Quando o cliente/equipe respondeu
  responded_at TIMESTAMPTZ,
  -- Vendedor responsável
  assigned_to UUID,
  mensagem_enviada TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wa_followup_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for wa_followup_queue"
  ON public.wa_followup_queue
  FOR ALL
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE TRIGGER update_wa_followup_queue_updated_at
  BEFORE UPDATE ON public.wa_followup_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_wa_followup_queue_status ON wa_followup_queue(status, scheduled_at);
CREATE INDEX idx_wa_followup_queue_conversation ON wa_followup_queue(conversation_id, status);
CREATE INDEX idx_wa_followup_rules_tenant ON wa_followup_rules(tenant_id, ativo);

-- Comentários
COMMENT ON TABLE wa_followup_rules IS 'Regras configuráveis de follow-up para conversas WhatsApp. Definem cenários, prazos e ações automáticas.';
COMMENT ON TABLE wa_followup_queue IS 'Fila de follow-ups pendentes/executados. Cada registro representa uma instância de follow-up para uma conversa específica.';
