
-- =============================================
-- FASE 1: Motor de SLA + Alertas Inteligentes
-- =============================================

-- Configuração de SLA por tenant
CREATE TABLE public.wa_sla_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  prazo_resposta_minutos INTEGER NOT NULL DEFAULT 60,
  escalonar_apos_minutos INTEGER NOT NULL DEFAULT 240,
  alerta_sonoro BOOLEAN NOT NULL DEFAULT true,
  alerta_visual BOOLEAN NOT NULL DEFAULT true,
  gerar_resumo_ia BOOLEAN NOT NULL DEFAULT true,
  horario_comercial_inicio TIME DEFAULT '08:00',
  horario_comercial_fim TIME DEFAULT '18:00',
  ignorar_fora_horario BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

ALTER TABLE public.wa_sla_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for wa_sla_config"
  ON public.wa_sla_config FOR ALL
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE TRIGGER update_wa_sla_config_updated_at
  BEFORE UPDATE ON public.wa_sla_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Alertas de SLA gerados automaticamente
CREATE TABLE public.wa_sla_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.wa_conversations(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('cliente_sem_resposta', 'atendente_sem_resposta', 'proposta_sem_retorno', 'conversa_esquecida')),
  assigned_to UUID REFERENCES auth.users(id),
  ai_summary TEXT,
  tempo_sem_resposta_minutos INTEGER,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES auth.users(id),
  escalated BOOLEAN NOT NULL DEFAULT false,
  escalated_at TIMESTAMPTZ,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wa_sla_alerts ENABLE ROW LEVEL SECURITY;

-- Admins see all alerts, consultants see only their own
CREATE POLICY "Admins see all SLA alerts"
  ON public.wa_sla_alerts FOR SELECT
  USING (
    tenant_id = get_user_tenant_id()
    AND (
      is_admin(auth.uid())
      OR assigned_to = auth.uid()
    )
  );

CREATE POLICY "System can insert SLA alerts"
  ON public.wa_sla_alerts FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can acknowledge their alerts"
  ON public.wa_sla_alerts FOR UPDATE
  USING (
    tenant_id = get_user_tenant_id()
    AND (is_admin(auth.uid()) OR assigned_to = auth.uid())
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id()
  );

-- Indexes for performance
CREATE INDEX idx_wa_sla_alerts_tenant_active ON public.wa_sla_alerts(tenant_id, acknowledged, resolved) WHERE acknowledged = false AND resolved = false;
CREATE INDEX idx_wa_sla_alerts_conversation ON public.wa_sla_alerts(conversation_id);
CREATE INDEX idx_wa_sla_alerts_assigned ON public.wa_sla_alerts(assigned_to) WHERE acknowledged = false;

-- =============================================
-- FASE 2: Motor de Cadências (substitui followup)
-- =============================================

-- Templates de cadência
CREATE TABLE public.wa_cadences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('pos_proposta', 'reativacao', 'pos_venda', 'custom')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  auto_enroll BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wa_cadences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for wa_cadences"
  ON public.wa_cadences FOR ALL
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE TRIGGER update_wa_cadences_updated_at
  BEFORE UPDATE ON public.wa_cadences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Steps de cada cadência
CREATE TABLE public.wa_cadence_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cadence_id UUID NOT NULL REFERENCES public.wa_cadences(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL DEFAULT 1,
  delay_hours INTEGER NOT NULL DEFAULT 24,
  nome TEXT NOT NULL,
  prompt_ia TEXT,
  fallback_template TEXT,
  canal TEXT NOT NULL DEFAULT 'whatsapp' CHECK (canal IN ('whatsapp', 'email', 'ambos')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cadence_id, ordem)
);

ALTER TABLE public.wa_cadence_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for wa_cadence_steps"
  ON public.wa_cadence_steps FOR ALL
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- Enrollments: conversa/lead inscrito numa cadência
CREATE TABLE public.wa_cadence_enrollments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cadence_id UUID NOT NULL REFERENCES public.wa_cadences(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.wa_conversations(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'pausada', 'concluida', 'cancelada', 'respondida')),
  current_step_ordem INTEGER NOT NULL DEFAULT 0,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  enrolled_by UUID REFERENCES auth.users(id),
  paused_at TIMESTAMPTZ,
  paused_reason TEXT,
  completed_at TIMESTAMPTZ,
  next_execution_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wa_cadence_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for wa_cadence_enrollments"
  ON public.wa_cadence_enrollments FOR ALL
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE TRIGGER update_wa_cadence_enrollments_updated_at
  BEFORE UPDATE ON public.wa_cadence_enrollments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_wa_cadence_enrollments_active ON public.wa_cadence_enrollments(tenant_id, status, next_execution_at) WHERE status = 'ativa';
CREATE INDEX idx_wa_cadence_enrollments_conv ON public.wa_cadence_enrollments(conversation_id);

-- Execuções: cada step executado
CREATE TABLE public.wa_cadence_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES public.wa_cadence_enrollments(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES public.wa_cadence_steps(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'enviado', 'pulado', 'respondido', 'falhou', 'bloqueado_ia')),
  ai_message TEXT,
  ai_confidence_score INTEGER,
  sent_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wa_cadence_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for wa_cadence_executions"
  ON public.wa_cadence_executions FOR ALL
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE INDEX idx_wa_cadence_executions_enrollment ON public.wa_cadence_executions(enrollment_id);

-- =============================================
-- FASE 4: Pós-Venda
-- =============================================

-- Catálogo de serviços
CREATE TABLE public.pv_servicos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('manutencao_preventiva', 'lavagem', 'revisao', 'troca_inversor', 'troca_modulo', 'extensao_garantia', 'monitoramento', 'outro')),
  preco_base NUMERIC(12,2) NOT NULL DEFAULT 0,
  duracao_estimada_min INTEGER DEFAULT 120,
  requer_agendamento BOOLEAN NOT NULL DEFAULT true,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pv_servicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for pv_servicos"
  ON public.pv_servicos FOR ALL
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE TRIGGER update_pv_servicos_updated_at
  BEFORE UPDATE ON public.pv_servicos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Contratos de manutenção
CREATE TABLE public.pv_contratos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  numero_contrato TEXT,
  tipo TEXT NOT NULL DEFAULT 'anual' CHECK (tipo IN ('anual', 'semestral', 'trimestral', 'avulso')),
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('rascunho', 'ativo', 'expirado', 'cancelado', 'renovacao_pendente')),
  valor_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_mensal NUMERIC(12,2),
  data_inicio DATE NOT NULL,
  data_fim DATE,
  periodicidade_meses INTEGER DEFAULT 6,
  proximo_servico_em DATE,
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pv_contratos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for pv_contratos"
  ON public.pv_contratos FOR ALL
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE TRIGGER update_pv_contratos_updated_at
  BEFORE UPDATE ON public.pv_contratos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_pv_contratos_cliente ON public.pv_contratos(cliente_id);
CREATE INDEX idx_pv_contratos_proximo ON public.pv_contratos(proximo_servico_em) WHERE status = 'ativo';

-- Serviços inclusos em cada contrato
CREATE TABLE public.pv_contrato_servicos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contrato_id UUID NOT NULL REFERENCES public.pv_contratos(id) ON DELETE CASCADE,
  servico_id UUID NOT NULL REFERENCES public.pv_servicos(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  quantidade INTEGER NOT NULL DEFAULT 1,
  preco_unitario NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pv_contrato_servicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for pv_contrato_servicos"
  ON public.pv_contrato_servicos FOR ALL
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- Ordens de Serviço
CREATE TABLE public.pv_ordens_servico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contrato_id UUID REFERENCES public.pv_contratos(id) ON DELETE SET NULL,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  servico_id UUID REFERENCES public.pv_servicos(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  numero_os TEXT,
  status TEXT NOT NULL DEFAULT 'agendada' CHECK (status IN ('agendada', 'em_andamento', 'concluida', 'cancelada', 'reagendada')),
  data_agendada DATE,
  data_execucao TIMESTAMPTZ,
  data_conclusao TIMESTAMPTZ,
  executado_por UUID REFERENCES auth.users(id),
  valor_cobrado NUMERIC(12,2),
  observacoes TEXT,
  laudo_tecnico TEXT,
  fotos_urls TEXT[],
  assinatura_cliente_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pv_ordens_servico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for pv_ordens_servico"
  ON public.pv_ordens_servico FOR ALL
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE TRIGGER update_pv_ordens_servico_updated_at
  BEFORE UPDATE ON public.pv_ordens_servico
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_pv_ordens_servico_cliente ON public.pv_ordens_servico(cliente_id);
CREATE INDEX idx_pv_ordens_servico_contrato ON public.pv_ordens_servico(contrato_id);

-- Checklist de execução da OS
CREATE TABLE public.pv_os_checklist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ordem_id UUID NOT NULL REFERENCES public.pv_ordens_servico(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 1,
  concluido BOOLEAN NOT NULL DEFAULT false,
  observacao TEXT,
  foto_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pv_os_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for pv_os_checklist"
  ON public.pv_os_checklist FOR ALL
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- Geração automática de número de contrato e OS
CREATE OR REPLACE FUNCTION public.generate_pv_contrato_numero()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _seq INTEGER;
BEGIN
  IF NEW.numero_contrato IS NULL THEN
    SELECT COALESCE(MAX(
      CASE WHEN numero_contrato ~ '^\d+$' THEN numero_contrato::integer ELSE 0 END
    ), 0) + 1 INTO _seq
    FROM pv_contratos WHERE tenant_id = NEW.tenant_id;
    NEW.numero_contrato := 'CTR-' || lpad(_seq::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_pv_contrato_numero
  BEFORE INSERT ON public.pv_contratos
  FOR EACH ROW EXECUTE FUNCTION generate_pv_contrato_numero();

CREATE OR REPLACE FUNCTION public.generate_pv_os_numero()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _seq INTEGER;
BEGIN
  IF NEW.numero_os IS NULL THEN
    SELECT COALESCE(MAX(
      CASE WHEN numero_os ~ '^\d+$' THEN numero_os::integer ELSE 0 END
    ), 0) + 1 INTO _seq
    FROM pv_ordens_servico WHERE tenant_id = NEW.tenant_id;
    NEW.numero_os := 'OS-' || lpad(_seq::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_pv_os_numero
  BEFORE INSERT ON public.pv_ordens_servico
  FOR EACH ROW EXECUTE FUNCTION generate_pv_os_numero();
