
-- ══════════════════════════════════════════════════════════════
-- MÓDULO 1: Distribuição de Leads + SLA de Atendimento
-- ══════════════════════════════════════════════════════════════

-- 1. Adicionar vendedor_id (FK) à tabela leads (coexiste com vendedor TEXT)
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS vendedor_id UUID REFERENCES public.vendedores(id);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS distribuido_em TIMESTAMPTZ;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS motivo_perda_id UUID;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS motivo_perda_obs TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS valor_estimado NUMERIC;

-- Index para busca por vendedor_id
CREATE INDEX IF NOT EXISTS idx_leads_vendedor_id ON public.leads(vendedor_id) WHERE vendedor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_distribuido_em ON public.leads(distribuido_em) WHERE distribuido_em IS NOT NULL;

-- 2. Adicionar probabilidade por etapa do pipeline
ALTER TABLE public.lead_status ADD COLUMN IF NOT EXISTS probabilidade_peso NUMERIC DEFAULT 0;
ALTER TABLE public.lead_status ADD COLUMN IF NOT EXISTS motivo_perda_obrigatorio BOOLEAN DEFAULT false;

-- Setar pesos padrão para etapas existentes
UPDATE public.lead_status SET probabilidade_peso = 10 WHERE nome = 'Novo';
UPDATE public.lead_status SET probabilidade_peso = 30 WHERE nome = 'Em Contato';
UPDATE public.lead_status SET probabilidade_peso = 50 WHERE nome = 'Proposta Enviada';
UPDATE public.lead_status SET probabilidade_peso = 60 WHERE nome = 'Aguardando Documentação';
UPDATE public.lead_status SET probabilidade_peso = 70 WHERE nome = 'Aguardando Validação';
UPDATE public.lead_status SET probabilidade_peso = 100 WHERE nome = 'Convertido';
UPDATE public.lead_status SET probabilidade_peso = 0, motivo_perda_obrigatorio = true WHERE nome = 'Perdido';

-- 3. Tabela de motivos de perda
CREATE TABLE IF NOT EXISTS public.motivos_perda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID DEFAULT get_user_tenant_id() REFERENCES public.tenants(id),
  nome TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.motivos_perda ENABLE ROW LEVEL SECURITY;

CREATE POLICY "motivos_perda_select" ON public.motivos_perda
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "motivos_perda_insert" ON public.motivos_perda
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

CREATE POLICY "motivos_perda_update" ON public.motivos_perda
  FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

CREATE POLICY "motivos_perda_delete" ON public.motivos_perda
  FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- Adicionar FK de motivo_perda após criar tabela
ALTER TABLE public.leads ADD CONSTRAINT leads_motivo_perda_id_fkey 
  FOREIGN KEY (motivo_perda_id) REFERENCES public.motivos_perda(id);

-- Seed motivos de perda padrão
INSERT INTO public.motivos_perda (tenant_id, nome, ordem) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Preço alto', 1),
  ('00000000-0000-0000-0000-000000000001', 'Escolheu concorrente', 2),
  ('00000000-0000-0000-0000-000000000001', 'Desistiu do projeto', 3),
  ('00000000-0000-0000-0000-000000000001', 'Sem retorno / não atende', 4),
  ('00000000-0000-0000-0000-000000000001', 'Financiamento não aprovado', 5),
  ('00000000-0000-0000-0000-000000000001', 'Problema no telhado/estrutura', 6),
  ('00000000-0000-0000-0000-000000000001', 'Lead inválido / spam', 7),
  ('00000000-0000-0000-0000-000000000001', 'Outro', 8);

-- 4. Regras de distribuição de leads
CREATE TABLE IF NOT EXISTS public.lead_distribution_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID DEFAULT get_user_tenant_id() REFERENCES public.tenants(id),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('round_robin', 'manual', 'regiao', 'capacidade')),
  config JSONB DEFAULT '{}',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.lead_distribution_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "distribution_rules_select" ON public.lead_distribution_rules
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "distribution_rules_admin" ON public.lead_distribution_rules
  FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- Inserir regra padrão de round-robin
INSERT INTO public.lead_distribution_rules (tenant_id, nome, tipo, config) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Round Robin Padrão', 'round_robin', 
   '{"vendedores_ids": [], "ultimo_vendedor_index": 0, "excluir_inativos": true}'::jsonb);

-- 5. Log de distribuição
CREATE TABLE IF NOT EXISTS public.lead_distribution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID DEFAULT get_user_tenant_id() REFERENCES public.tenants(id),
  lead_id UUID NOT NULL REFERENCES public.leads(id),
  vendedor_id UUID NOT NULL REFERENCES public.vendedores(id),
  vendedor_anterior_id UUID REFERENCES public.vendedores(id),
  rule_id UUID REFERENCES public.lead_distribution_rules(id),
  motivo TEXT,
  distribuido_em TIMESTAMPTZ DEFAULT now(),
  distribuido_por UUID
);

ALTER TABLE public.lead_distribution_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "distribution_log_select" ON public.lead_distribution_log
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "distribution_log_insert" ON public.lead_distribution_log
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE INDEX IF NOT EXISTS idx_distribution_log_lead ON public.lead_distribution_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_distribution_log_vendedor ON public.lead_distribution_log(vendedor_id);

-- 6. Violações de SLA
CREATE TABLE IF NOT EXISTS public.sla_breaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID DEFAULT get_user_tenant_id() REFERENCES public.tenants(id),
  lead_id UUID NOT NULL REFERENCES public.leads(id),
  vendedor_id UUID REFERENCES public.vendedores(id),
  sla_rule_id UUID REFERENCES public.sla_rules(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('primeiro_contato', 'followup', 'resposta')),
  minutos_limite INTEGER NOT NULL,
  minutos_real INTEGER,
  escalado BOOLEAN DEFAULT false,
  escalado_para UUID,
  resolvido BOOLEAN DEFAULT false,
  resolvido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.sla_breaches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sla_breaches_select" ON public.sla_breaches
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "sla_breaches_insert" ON public.sla_breaches
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "sla_breaches_update" ON public.sla_breaches
  FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE INDEX IF NOT EXISTS idx_sla_breaches_lead ON public.sla_breaches(lead_id);
CREATE INDEX IF NOT EXISTS idx_sla_breaches_vendedor ON public.sla_breaches(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_sla_breaches_pending ON public.sla_breaches(resolvido, created_at) WHERE resolvido = false;

-- 7. Comentário/documentação nas tabelas
COMMENT ON TABLE public.motivos_perda IS 'Catálogo de motivos de perda configuráveis pelo admin para registro obrigatório ao mover lead para "Perdido"';
COMMENT ON TABLE public.lead_distribution_rules IS 'Regras de distribuição automática de leads (round-robin, por região, capacidade)';
COMMENT ON TABLE public.lead_distribution_log IS 'Histórico de todas as atribuições de leads a vendedores (automáticas e manuais)';
COMMENT ON TABLE public.sla_breaches IS 'Registro de violações de SLA (primeiro contato, followup) com tracking de escalação';
COMMENT ON COLUMN public.leads.vendedor_id IS 'FK para vendedores - substituição gradual do campo TEXT vendedor';
COMMENT ON COLUMN public.leads.valor_estimado IS 'Valor estimado do deal para forecast (pode vir do orçamento vinculado)';
COMMENT ON COLUMN public.lead_status.probabilidade_peso IS 'Peso (0-100) da etapa para cálculo de forecast ponderado';
COMMENT ON COLUMN public.lead_status.motivo_perda_obrigatorio IS 'Se true, exige motivo_perda ao mover lead para este status';

-- 8. Trigger para updated_at nas novas tabelas
CREATE TRIGGER update_lead_distribution_rules_updated_at
  BEFORE UPDATE ON public.lead_distribution_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
