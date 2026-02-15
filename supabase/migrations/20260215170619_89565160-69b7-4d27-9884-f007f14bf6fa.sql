-- ═══════════════════════════════════════════════════════════
-- Pipeline Automation Rules
-- Triggers automatic actions when deals stay in a stage too long
-- ═══════════════════════════════════════════════════════════

CREATE TABLE public.pipeline_automations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT 'Nova automação',
  ativo BOOLEAN NOT NULL DEFAULT true,
  
  -- Trigger condition
  tipo_gatilho TEXT NOT NULL DEFAULT 'tempo_parado', -- 'tempo_parado', 'entrada_etapa'
  tempo_horas INTEGER NOT NULL DEFAULT 48, -- hours before triggering
  
  -- Action
  tipo_acao TEXT NOT NULL DEFAULT 'mover_etapa', -- 'mover_etapa', 'notificar', 'alterar_status'
  destino_stage_id UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL,
  notificar_responsavel BOOLEAN NOT NULL DEFAULT false,
  mensagem_notificacao TEXT,
  
  -- Metadata
  execucoes_total INTEGER NOT NULL DEFAULT 0,
  ultima_execucao TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pipeline_automations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their tenant automations"
  ON public.pipeline_automations FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create automations for their tenant"
  ON public.pipeline_automations FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update their tenant automations"
  ON public.pipeline_automations FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete their tenant automations"
  ON public.pipeline_automations FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- Indexes
CREATE INDEX idx_pipeline_automations_tenant ON pipeline_automations(tenant_id);
CREATE INDEX idx_pipeline_automations_stage ON pipeline_automations(stage_id);
CREATE INDEX idx_pipeline_automations_active ON pipeline_automations(ativo) WHERE ativo = true;

-- Updated_at trigger
CREATE TRIGGER update_pipeline_automations_updated_at
  BEFORE UPDATE ON public.pipeline_automations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════════════════════
-- Automation Execution Log
-- ═══════════════════════════════════════════════════════════

CREATE TABLE public.pipeline_automation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  automation_id UUID NOT NULL REFERENCES pipeline_automations(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  acao_executada TEXT NOT NULL,
  detalhes JSONB,
  status TEXT NOT NULL DEFAULT 'sucesso', -- 'sucesso', 'erro', 'ignorado'
  erro_mensagem TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pipeline_automation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant automation logs"
  ON public.pipeline_automation_logs FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Service role can insert automation logs"
  ON public.pipeline_automation_logs FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_automation_logs_tenant ON pipeline_automation_logs(tenant_id);
CREATE INDEX idx_automation_logs_automation ON pipeline_automation_logs(automation_id);
CREATE INDEX idx_automation_logs_deal ON pipeline_automation_logs(deal_id);