
-- =====================================================
-- P0: ENFORCE tenant_id NOT NULL on transactional tables
-- All verified: 0 NULL rows in any table
-- =====================================================

-- FINANCIAL
ALTER TABLE public.comissoes ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.parcelas ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.pagamentos ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.pagamentos_comissao ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.recebimentos ALTER COLUMN tenant_id SET NOT NULL;

-- OPERATIONAL
ALTER TABLE public.projetos ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.obras ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.servicos_agendados ALTER COLUMN tenant_id SET NOT NULL;

-- LEADS & SCORING
ALTER TABLE public.lead_atividades ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.lead_scores ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.lead_distribution_log ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.lead_distribution_rules ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.lead_scoring_config ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.lead_status ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.motivos_perda ALTER COLUMN tenant_id SET NOT NULL;

-- PROPOSALS
ALTER TABLE public.proposta_itens ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.proposta_variaveis ALTER COLUMN tenant_id SET NOT NULL;

-- CHECKLISTS
ALTER TABLE public.checklists_cliente ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.checklists_instalacao ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.checklists_instalador ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.checklist_template_items ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.checklist_templates ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.checklist_cliente_arquivos ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.checklist_cliente_respostas ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.checklist_instalador_arquivos ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.checklist_instalador_respostas ALTER COLUMN tenant_id SET NOT NULL;

-- SLA
ALTER TABLE public.sla_rules ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.sla_breaches ALTER COLUMN tenant_id SET NOT NULL;

-- SIMULAÇÕES & PUSH
ALTER TABLE public.simulacoes ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.push_sent_log ALTER COLUMN tenant_id SET NOT NULL;

-- =====================================================
-- P1 #4: Fix overly permissive WITH CHECK(true) policies
-- Replace WITH CHECK(true) → WITH CHECK(tenant_id IS NOT NULL) 
-- on service_role policies that don't validate tenant
-- =====================================================

-- push_sent_log: was WITH CHECK(true), now enforce tenant_id
DROP POLICY IF EXISTS "rls_push_sent_log_service" ON public.push_sent_log;
CREATE POLICY "rls_push_sent_log_service" ON public.push_sent_log
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (tenant_id IS NOT NULL);

-- wa_satisfaction_ratings: was WITH CHECK(true)
DROP POLICY IF EXISTS "Service role full access to satisfaction ratings" ON public.wa_satisfaction_ratings;
CREATE POLICY "rls_wa_satisfaction_ratings_service" ON public.wa_satisfaction_ratings
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (tenant_id IS NOT NULL);

-- wa_instance_vendedores: was WITH CHECK(true), enforce tenant presence
DROP POLICY IF EXISTS "rls_wa_instance_vendedores_service" ON public.wa_instance_vendedores;
CREATE POLICY "rls_wa_instance_vendedores_service" ON public.wa_instance_vendedores
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true); -- M:N junction table, tenant validated via FK constraints
