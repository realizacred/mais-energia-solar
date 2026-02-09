
-- ============================================================
-- MIGRAÇÃO DE SEGURANÇA: ISOLAMENTO MULTI-TENANT
-- ============================================================

-- 1. Corrigir defaults de tenant_id para usar get_user_tenant_id()
-- Tabelas que usam hardcoded UUID como default
ALTER TABLE public.ai_insights ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE public.audit_logs ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE public.brand_settings ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE public.calculadora_config ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE public.checklist_cliente_arquivos ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE public.checklist_cliente_respostas ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE public.checklist_instalador_arquivos ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE public.checklist_instalador_respostas ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE public.checklist_template_items ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE public.checklist_templates ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE public.checklists_cliente ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE public.checklists_instalacao ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE public.checklists_instalador ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE public.clientes ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE public.comissoes ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE public.concessionarias ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE public.disjuntores ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE public.financiamento_api_config ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE public.inversores ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE public.lead_atividades ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE public.lead_scores ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE public.leads ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE public.modulos_fotovoltaicos ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE public.orcamentos ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE public.pagamentos ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE public.parcelas ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE public.profiles ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE public.projetos ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE public.recebimentos ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE public.servicos_agendados ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE public.simulacoes ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE public.vendedores ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE public.vendedor_achievements ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE public.vendedor_metas ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE public.wa_conversations ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE public.wa_instances ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE public.wa_messages ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE public.baterias ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE public.transformadores ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();

-- 2. Corrigir funções SECURITY DEFINER para filtrar por tenant_id
CREATE OR REPLACE FUNCTION public.get_calculator_config()
RETURNS TABLE(tarifa_media_kwh numeric, custo_por_kwp numeric, geracao_mensal_por_kwp integer, kg_co2_por_kwh numeric, percentual_economia integer, vida_util_sistema integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT tarifa_media_kwh, custo_por_kwp, geracao_mensal_por_kwp,
         kg_co2_por_kwh, percentual_economia, vida_util_sistema
  FROM calculadora_config
  WHERE tenant_id = get_user_tenant_id()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_payback_config()
RETURNS TABLE(custo_disponibilidade_monofasico numeric, custo_disponibilidade_bifasico numeric, custo_disponibilidade_trifasico numeric, taxas_fixas_mensais numeric, degradacao_anual_painel numeric, reajuste_anual_tarifa numeric, tarifa_fio_b_padrao numeric)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT custo_disponibilidade_monofasico, custo_disponibilidade_bifasico,
         custo_disponibilidade_trifasico, taxas_fixas_mensais,
         degradacao_anual_painel, reajuste_anual_tarifa, tarifa_fio_b_padrao
  FROM payback_config
  WHERE tenant_id = get_user_tenant_id()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_active_financing_banks()
RETURNS TABLE(nome text, taxa_mensal numeric, max_parcelas integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT nome, taxa_mensal, max_parcelas
  FROM financiamento_bancos
  WHERE ativo = true AND tenant_id = get_user_tenant_id()
  ORDER BY ordem ASC, nome ASC;
$$;

-- 3. Adicionar índices compostos para performance multi-tenant
CREATE INDEX IF NOT EXISTS idx_leads_tenant_created ON public.leads (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_status ON public.leads (tenant_id, status_id);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_vendedor ON public.leads (tenant_id, vendedor_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_tenant_created ON public.orcamentos (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_messages_tenant_created ON public.wa_messages (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_conversations_tenant ON public.wa_conversations (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_clientes_tenant ON public.clientes (tenant_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_tenant_status ON public.parcelas (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_comissoes_tenant_status ON public.comissoes (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_servicos_tenant ON public.servicos_agendados (tenant_id);
CREATE INDEX IF NOT EXISTS idx_lead_atividades_tenant ON public.lead_atividades (tenant_id, lead_id);
CREATE INDEX IF NOT EXISTS idx_projetos_tenant ON public.projetos (tenant_id);
CREATE INDEX IF NOT EXISTS idx_recebimentos_tenant ON public.recebimentos (tenant_id);

-- 4. Corrigir funções de dashboard para filtrar por tenant
CREATE OR REPLACE FUNCTION public.check_phone_duplicate(_telefone text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  normalized text;
  found boolean;
BEGIN
  normalized := regexp_replace(_telefone, '[^0-9]', '', 'g');
  
  SELECT EXISTS(
    SELECT 1 FROM leads
    WHERE tenant_id = get_user_tenant_id()
      AND (telefone_normalized = normalized
        OR regexp_replace(telefone, '[^0-9]', '', 'g') = normalized)
  ) INTO found;
  
  RETURN found;
END;
$$;

-- 5. Função auxiliar para verificar tenant_id do usuário logado (para RLS)
CREATE OR REPLACE FUNCTION public.user_belongs_to_tenant(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _tenant_id = get_user_tenant_id()
$$;
