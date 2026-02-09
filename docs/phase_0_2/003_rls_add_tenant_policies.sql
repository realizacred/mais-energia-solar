-- ================================================================
-- MIGRATION 003: CRIAR POLICIES TENANT-AWARE
-- Fase 0.2 do Plano de Endurecimento Multi-Tenant
-- Data: 2026-02-09
-- ================================================================
--
-- RESUMO:
-- - Cria ~220 novas policies com prefixo 'rls_'
-- - Todas incluem filtro tenant_id = get_user_tenant_id()
-- - NÃO remove policies legadas (ver migration 004)
--
-- ATENÇÃO CRÍTICA:
-- Policies PERMISSIVE usam lógica OR no PostgreSQL.
-- Entre 003 e 004, policies antigas AINDA permitem acesso cross-tenant.
-- Aplicar 004 IMEDIATAMENTE após validar 003.
--
-- TABELAS IGNORADAS (já possuem filtro tenant correto):
-- lead_distribution_log, lead_distribution_rules, motivos_perda,
-- site_banners, site_settings, tenants, wa_satisfaction_ratings
--
-- TABELAS SEM COLUNA tenant_id (gap para Fase 3):
-- wa_conversation_tags, whatsapp_conversation_tags, backfill_audit
--
-- ISSUE CONHECIDA (PRE-EXISTENTE):
-- leads, orcamentos usam DEFAULT require_tenant_id() que falha para
-- inserts anônimos (auth.uid() = NULL). Precisa fix separado no schema
-- (trocar DEFAULT para get_user_tenant_id() ou trigger de resolução).
-- ================================================================

BEGIN;

-- ============================================================
-- CLASSE A: TENANT_ADMIN_ONLY
-- Admin do tenant pode ler/escrever. Sem acesso para users comuns.
-- ============================================================

-- A1: ai_insights
CREATE POLICY "rls_ai_insights_all_admin"
  ON public.ai_insights FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- A2: audit_logs (IMUTÁVEL - apenas SELECT via admin)
CREATE POLICY "rls_audit_logs_select_admin"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- A3: calculadora_config
-- Nota: leitura pública via security definer get_calculator_config() - não precisa policy anon
CREATE POLICY "rls_calculadora_config_all_admin"
  ON public.calculadora_config FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- A4: financiamento_api_config
CREATE POLICY "rls_financiamento_api_config_all_admin"
  ON public.financiamento_api_config FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- A5: instagram_config
CREATE POLICY "rls_instagram_config_all_admin"
  ON public.instagram_config FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- A6: pagamentos
CREATE POLICY "rls_pagamentos_all_admin"
  ON public.pagamentos FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- A7: pagamentos_comissao
CREATE POLICY "rls_pagamentos_comissao_all_admin"
  ON public.pagamentos_comissao FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- A8: parcelas
CREATE POLICY "rls_parcelas_all_admin"
  ON public.parcelas FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- A9: recebimentos
CREATE POLICY "rls_recebimentos_all_admin"
  ON public.recebimentos FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- A10: release_checklists
CREATE POLICY "rls_release_checklists_all_admin"
  ON public.release_checklists FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- A11: solar_market_config
CREATE POLICY "rls_solar_market_config_all_admin"
  ON public.solar_market_config FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- A12: webhook_config
CREATE POLICY "rls_webhook_config_all_admin"
  ON public.webhook_config FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- A13: whatsapp_automation_config
CREATE POLICY "rls_whatsapp_automation_config_all_admin"
  ON public.whatsapp_automation_config FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- A14: whatsapp_automation_logs
CREATE POLICY "rls_whatsapp_automation_logs_all_admin"
  ON public.whatsapp_automation_logs FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- A15: whatsapp_messages (legacy system - admin only)
CREATE POLICY "rls_whatsapp_messages_all_admin"
  ON public.whatsapp_messages FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- A16: wa_webhook_events
CREATE POLICY "rls_wa_webhook_events_all_admin"
  ON public.wa_webhook_events FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
-- service_role for edge function writes
CREATE POLICY "rls_wa_webhook_events_service"
  ON public.wa_webhook_events FOR ALL TO service_role
  USING (true) WITH CHECK (tenant_id IS NOT NULL);


-- ============================================================
-- CLASSE B: TENANT_USER_READ + ADMIN_WRITE
-- Todos os users autenticados do tenant podem LER.
-- Apenas admin pode escrever. Algumas com leitura anon/public.
-- ============================================================

-- B1: baterias
CREATE POLICY "rls_baterias_select_tenant"
  ON public.baterias FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "rls_baterias_insert_admin"
  ON public.baterias FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_baterias_update_admin"
  ON public.baterias FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_baterias_delete_admin"
  ON public.baterias FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- B2: brand_settings (public read para site, admin write)
CREATE POLICY "rls_brand_settings_select_public"
  ON public.brand_settings FOR SELECT TO anon, authenticated
  USING (true); -- Dados públicos do site (tema/logo). Frontend filtra por tenant.
CREATE POLICY "rls_brand_settings_all_admin"
  ON public.brand_settings FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- B3: checklist_template_items
CREATE POLICY "rls_checklist_template_items_select_tenant"
  ON public.checklist_template_items FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "rls_checklist_template_items_all_admin"
  ON public.checklist_template_items FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- B4: checklist_templates
CREATE POLICY "rls_checklist_templates_select_tenant"
  ON public.checklist_templates FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND ativo = true);
CREATE POLICY "rls_checklist_templates_all_admin"
  ON public.checklist_templates FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- B5: concessionarias (anon read para calculadora, admin write)
CREATE POLICY "rls_concessionarias_select_anon"
  ON public.concessionarias FOR SELECT TO anon
  USING (ativo = true); -- Calculadora pública. Frontend filtra por tenant.
CREATE POLICY "rls_concessionarias_select_tenant"
  ON public.concessionarias FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "rls_concessionarias_all_admin"
  ON public.concessionarias FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- B6: config_tributaria_estado (public read, admin write)
CREATE POLICY "rls_config_tributaria_estado_select_public"
  ON public.config_tributaria_estado FOR SELECT TO anon, authenticated
  USING (true); -- Dados tributários públicos, usados na calculadora.
CREATE POLICY "rls_config_tributaria_estado_all_admin"
  ON public.config_tributaria_estado FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- B7: disjuntores
CREATE POLICY "rls_disjuntores_select_tenant"
  ON public.disjuntores FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "rls_disjuntores_all_admin"
  ON public.disjuntores FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- B8: financiamento_bancos (leitura via security definer, admin write)
CREATE POLICY "rls_financiamento_bancos_all_admin"
  ON public.financiamento_bancos FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- B9: fio_b_escalonamento (public read, admin write)
CREATE POLICY "rls_fio_b_escalonamento_select_public"
  ON public.fio_b_escalonamento FOR SELECT TO anon, authenticated
  USING (true); -- Dados públicos de escalonamento fio B.
CREATE POLICY "rls_fio_b_escalonamento_all_admin"
  ON public.fio_b_escalonamento FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- B10: gamification_config
CREATE POLICY "rls_gamification_config_select_tenant"
  ON public.gamification_config FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "rls_gamification_config_all_admin"
  ON public.gamification_config FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- B11: instalador_config
CREATE POLICY "rls_instalador_config_select_tenant"
  ON public.instalador_config FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "rls_instalador_config_all_admin"
  ON public.instalador_config FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- B12: inversores
CREATE POLICY "rls_inversores_select_tenant"
  ON public.inversores FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "rls_inversores_insert_admin"
  ON public.inversores FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_inversores_update_admin"
  ON public.inversores FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_inversores_delete_admin"
  ON public.inversores FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- B13: lead_scoring_config
CREATE POLICY "rls_lead_scoring_config_select_tenant"
  ON public.lead_scoring_config FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "rls_lead_scoring_config_all_admin"
  ON public.lead_scoring_config FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- B14: lead_status
CREATE POLICY "rls_lead_status_select_tenant"
  ON public.lead_status FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "rls_lead_status_all_admin"
  ON public.lead_status FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- B15: modulos_fotovoltaicos
CREATE POLICY "rls_modulos_fotovoltaicos_select_tenant"
  ON public.modulos_fotovoltaicos FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "rls_modulos_fotovoltaicos_insert_admin"
  ON public.modulos_fotovoltaicos FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_modulos_fotovoltaicos_update_admin"
  ON public.modulos_fotovoltaicos FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_modulos_fotovoltaicos_delete_admin"
  ON public.modulos_fotovoltaicos FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- B16: payback_config (anon read para calculadora, admin write)
CREATE POLICY "rls_payback_config_select_public"
  ON public.payback_config FOR SELECT TO anon, authenticated
  USING (true); -- Dados públicos payback, usados na calculadora.
CREATE POLICY "rls_payback_config_all_admin"
  ON public.payback_config FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- B17: proposal_variables
CREATE POLICY "rls_proposal_variables_select_tenant"
  ON public.proposal_variables FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "rls_proposal_variables_all_admin"
  ON public.proposal_variables FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- B18: sla_rules
CREATE POLICY "rls_sla_rules_select_tenant"
  ON public.sla_rules FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "rls_sla_rules_all_admin"
  ON public.sla_rules FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- B19: transformadores
CREATE POLICY "rls_transformadores_select_tenant"
  ON public.transformadores FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "rls_transformadores_all_admin"
  ON public.transformadores FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- B20: vendedores (authenticated read, admin write)
CREATE POLICY "rls_vendedores_select_tenant"
  ON public.vendedores FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "rls_vendedores_all_admin"
  ON public.vendedores FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- B21: wa_quick_replies
CREATE POLICY "rls_wa_quick_replies_select_tenant"
  ON public.wa_quick_replies FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "rls_wa_quick_replies_insert_admin"
  ON public.wa_quick_replies FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_wa_quick_replies_update_admin"
  ON public.wa_quick_replies FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_wa_quick_replies_delete_admin"
  ON public.wa_quick_replies FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- B22: wa_quick_reply_categories
CREATE POLICY "rls_wa_quick_reply_categories_select_tenant"
  ON public.wa_quick_reply_categories FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "rls_wa_quick_reply_categories_all_admin"
  ON public.wa_quick_reply_categories FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- B23: wa_tags
CREATE POLICY "rls_wa_tags_select_tenant"
  ON public.wa_tags FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "rls_wa_tags_all_admin"
  ON public.wa_tags FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- B24: whatsapp_automation_templates
CREATE POLICY "rls_whatsapp_automation_templates_select_tenant"
  ON public.whatsapp_automation_templates FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "rls_whatsapp_automation_templates_all_admin"
  ON public.whatsapp_automation_templates FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- B25: whatsapp_tags
CREATE POLICY "rls_whatsapp_tags_select_tenant"
  ON public.whatsapp_tags FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "rls_whatsapp_tags_all_admin"
  ON public.whatsapp_tags FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));


-- ============================================================
-- CLASSE C: TENANT_HYBRID (admin + owner/vendedor/instalador)
-- Admin do tenant: acesso total. Users: apenas seus dados.
-- ============================================================

-- C1: leads (admin + vendedor + public insert)
CREATE POLICY "rls_leads_all_admin"
  ON public.leads FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_leads_select_vendedor"
  ON public.leads FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND vendedor IN (
      SELECT v.nome FROM vendedores v
      WHERE v.user_id = auth.uid() AND v.tenant_id = get_user_tenant_id()
    )
  );
-- Vendedor pode ver leads vinculados a conversas WA atribuídas a ele
CREATE POLICY "rls_leads_select_wa_assigned"
  ON public.leads FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND id IN (
      SELECT wc.lead_id FROM wa_conversations wc
      WHERE wc.lead_id = leads.id
        AND wc.assigned_to = auth.uid()
        AND wc.tenant_id = get_user_tenant_id()
    )
  );
-- Insert público (formulário do site) - mantém validação de campos
-- NOTA: tenant_id é resolvido pelo DEFAULT da coluna
CREATE POLICY "rls_leads_insert_public"
  ON public.leads FOR INSERT TO anon
  WITH CHECK (
    nome IS NOT NULL AND length(TRIM(BOTH FROM nome)) >= 2
    AND telefone IS NOT NULL AND length(TRIM(BOTH FROM telefone)) >= 10
    AND cidade IS NOT NULL AND estado IS NOT NULL
    AND area IS NOT NULL AND tipo_telhado IS NOT NULL
    AND rede_atendimento IS NOT NULL
    AND media_consumo IS NOT NULL AND media_consumo >= 0
    AND consumo_previsto IS NOT NULL AND consumo_previsto >= 0
    AND visto = false AND visto_admin = false
    AND status_id IS NULL AND observacoes IS NULL AND lead_code IS NULL
  );

-- C2: orcamentos (admin + vendedor + public insert)
CREATE POLICY "rls_orcamentos_all_admin"
  ON public.orcamentos FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_orcamentos_select_vendedor"
  ON public.orcamentos FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND vendedor IN (
      SELECT v.nome FROM vendedores v
      WHERE v.user_id = auth.uid() AND v.tenant_id = get_user_tenant_id()
    )
  );
CREATE POLICY "rls_orcamentos_update_vendedor"
  ON public.orcamentos FOR UPDATE TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND vendedor IN (
      SELECT v.nome FROM vendedores v
      WHERE v.user_id = auth.uid() AND v.tenant_id = get_user_tenant_id()
    )
  );
CREATE POLICY "rls_orcamentos_delete_vendedor"
  ON public.orcamentos FOR DELETE TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND vendedor IN (
      SELECT v.nome FROM vendedores v
      WHERE v.user_id = auth.uid() AND v.tenant_id = get_user_tenant_id()
    )
  );
-- Insert público (formulário do site)
CREATE POLICY "rls_orcamentos_insert_public"
  ON public.orcamentos FOR INSERT TO anon
  WITH CHECK (
    lead_id IS NOT NULL AND tipo_telhado IS NOT NULL
    AND area IS NOT NULL AND estado IS NOT NULL AND cidade IS NOT NULL
    AND rede_atendimento IS NOT NULL
    AND media_consumo IS NOT NULL AND media_consumo > 0
    AND consumo_previsto IS NOT NULL AND consumo_previsto > 0
    AND visto = false AND visto_admin = false
    AND status_id IS NULL AND observacoes IS NULL AND orc_code IS NULL
  );

-- C3: clientes (admin + vendedor via lead)
CREATE POLICY "rls_clientes_all_admin"
  ON public.clientes FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_clientes_select_vendedor"
  ON public.clientes FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND lead_id IN (
      SELECT l.id FROM leads l
      WHERE l.tenant_id = get_user_tenant_id()
        AND l.vendedor IN (
          SELECT v.nome FROM vendedores v
          WHERE v.user_id = auth.uid() AND v.tenant_id = get_user_tenant_id()
        )
    )
  );

-- C4: comissoes (admin + vendedor own)
CREATE POLICY "rls_comissoes_all_admin"
  ON public.comissoes FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_comissoes_select_vendedor"
  ON public.comissoes FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND vendedor_id IN (
      SELECT v.id FROM vendedores v
      WHERE v.user_id = auth.uid() AND v.tenant_id = get_user_tenant_id()
    )
  );

-- C5: projetos (admin + vendedor + instalador)
CREATE POLICY "rls_projetos_all_admin"
  ON public.projetos FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_projetos_select_vendedor"
  ON public.projetos FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND vendedor_id IN (
      SELECT v.id FROM vendedores v
      WHERE v.user_id = auth.uid() AND v.tenant_id = get_user_tenant_id()
    )
  );
CREATE POLICY "rls_projetos_select_instalador"
  ON public.projetos FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND instalador_id = auth.uid());

-- C6: propostas (admin + vendedor)
CREATE POLICY "rls_propostas_all_admin"
  ON public.propostas FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_propostas_select_vendedor"
  ON public.propostas FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND vendedor_id IN (
      SELECT v.id FROM vendedores v
      WHERE v.user_id = auth.uid() AND v.tenant_id = get_user_tenant_id()
    )
  );

-- C7: proposta_itens (admin + vendedor via proposta)
CREATE POLICY "rls_proposta_itens_all_admin"
  ON public.proposta_itens FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_proposta_itens_select_vendedor"
  ON public.proposta_itens FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND proposta_id IN (
      SELECT p.id FROM propostas p
      WHERE p.tenant_id = get_user_tenant_id()
        AND p.vendedor_id IN (
          SELECT v.id FROM vendedores v
          WHERE v.user_id = auth.uid() AND v.tenant_id = get_user_tenant_id()
        )
    )
  );

-- C8: proposta_variaveis (admin + vendedor via proposta)
CREATE POLICY "rls_proposta_variaveis_all_admin"
  ON public.proposta_variaveis FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_proposta_variaveis_select_vendedor"
  ON public.proposta_variaveis FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND proposta_id IN (
      SELECT p.id FROM propostas p
      WHERE p.tenant_id = get_user_tenant_id()
        AND p.vendedor_id IN (
          SELECT v.id FROM vendedores v
          WHERE v.user_id = auth.uid() AND v.tenant_id = get_user_tenant_id()
        )
    )
  );

-- C9: lead_atividades (admin + creator)
CREATE POLICY "rls_lead_atividades_all_admin"
  ON public.lead_atividades FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_lead_atividades_all_owner"
  ON public.lead_atividades FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND created_by = auth.uid())
  WITH CHECK (tenant_id = get_user_tenant_id() AND created_by = auth.uid());

-- C10: lead_scores (admin + vendedor via lead)
CREATE POLICY "rls_lead_scores_all_admin"
  ON public.lead_scores FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_lead_scores_select_vendedor"
  ON public.lead_scores FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND lead_id IN (
      SELECT l.id FROM leads l
      WHERE l.tenant_id = get_user_tenant_id()
        AND l.vendedor IN (
          SELECT v.nome FROM vendedores v
          WHERE v.user_id = auth.uid() AND v.tenant_id = get_user_tenant_id()
        )
    )
  );

-- C11: lead_links (admin + service_role)
CREATE POLICY "rls_lead_links_all_admin"
  ON public.lead_links FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_lead_links_service"
  ON public.lead_links FOR ALL TO service_role
  USING (true) WITH CHECK (tenant_id IS NOT NULL);

-- C12: servicos_agendados (admin + instalador)
CREATE POLICY "rls_servicos_agendados_all_admin"
  ON public.servicos_agendados FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_servicos_agendados_select_instalador"
  ON public.servicos_agendados FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND instalador_id = auth.uid());
CREATE POLICY "rls_servicos_agendados_update_instalador"
  ON public.servicos_agendados FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id() AND instalador_id = auth.uid())
  WITH CHECK (tenant_id = get_user_tenant_id() AND instalador_id = auth.uid());

-- C13: checklists_cliente (admin only com tenant)
CREATE POLICY "rls_checklists_cliente_all_admin"
  ON public.checklists_cliente FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- C14: checklist_cliente_arquivos
CREATE POLICY "rls_checklist_cliente_arquivos_all_admin"
  ON public.checklist_cliente_arquivos FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- C15: checklist_cliente_respostas
CREATE POLICY "rls_checklist_cliente_respostas_all_admin"
  ON public.checklist_cliente_respostas FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- C16: meta_notifications (admin + vendedor own)
CREATE POLICY "rls_meta_notifications_all_admin"
  ON public.meta_notifications FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_meta_notifications_all_vendedor"
  ON public.meta_notifications FOR ALL TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND vendedor_id IN (
      SELECT v.id FROM vendedores v
      WHERE v.user_id = auth.uid() AND v.tenant_id = get_user_tenant_id()
    )
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND vendedor_id IN (
      SELECT v.id FROM vendedores v
      WHERE v.user_id = auth.uid() AND v.tenant_id = get_user_tenant_id()
    )
  );

-- C17: tasks (admin + assigned user)
CREATE POLICY "rls_tasks_all_admin"
  ON public.tasks FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_tasks_select_assigned"
  ON public.tasks FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND assigned_to = auth.uid());
CREATE POLICY "rls_tasks_update_assigned"
  ON public.tasks FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id() AND assigned_to = auth.uid())
  WITH CHECK (tenant_id = get_user_tenant_id() AND assigned_to = auth.uid());

-- C18: task_events (admin + owner/assigned)
CREATE POLICY "rls_task_events_all_admin"
  ON public.task_events FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_task_events_select_user"
  ON public.task_events FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND (
      user_id = auth.uid()
      OR task_id IN (
        SELECT t.id FROM tasks t
        WHERE t.assigned_to = auth.uid() AND t.tenant_id = get_user_tenant_id()
      )
    )
  );

-- C19: obras (admin + public read ativo)
CREATE POLICY "rls_obras_all_admin"
  ON public.obras FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_obras_select_public"
  ON public.obras FOR SELECT TO anon, authenticated
  USING (ativo = true); -- Portfolio público. Frontend filtra por tenant.

-- C20: instalador_metas (admin + instalador own)
CREATE POLICY "rls_instalador_metas_all_admin"
  ON public.instalador_metas FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_instalador_metas_select_own"
  ON public.instalador_metas FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND instalador_id = auth.uid());

-- C21: instalador_performance_mensal (admin + instalador own)
CREATE POLICY "rls_instalador_performance_mensal_all_admin"
  ON public.instalador_performance_mensal FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_instalador_performance_mensal_select_own"
  ON public.instalador_performance_mensal FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND instalador_id = auth.uid());

-- C22: vendedor_achievements (admin + vendedor own)
CREATE POLICY "rls_vendedor_achievements_all_admin"
  ON public.vendedor_achievements FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_vendedor_achievements_select_own"
  ON public.vendedor_achievements FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND vendedor_id IN (
      SELECT v.id FROM vendedores v
      WHERE v.user_id = auth.uid() AND v.tenant_id = get_user_tenant_id()
    )
  );

-- C23: vendedor_metas (admin + vendedor own)
CREATE POLICY "rls_vendedor_metas_all_admin"
  ON public.vendedor_metas FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_vendedor_metas_select_own"
  ON public.vendedor_metas FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND vendedor_id IN (
      SELECT v.id FROM vendedores v
      WHERE v.user_id = auth.uid() AND v.tenant_id = get_user_tenant_id()
    )
  );

-- C24: vendedor_metricas (admin + vendedor own)
CREATE POLICY "rls_vendedor_metricas_all_admin"
  ON public.vendedor_metricas FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_vendedor_metricas_select_own"
  ON public.vendedor_metricas FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND vendedor_id IN (
      SELECT v.id FROM vendedores v
      WHERE v.user_id = auth.uid() AND v.tenant_id = get_user_tenant_id()
    )
  );

-- C25: vendedor_performance_mensal (admin + vendedor own)
CREATE POLICY "rls_vendedor_performance_mensal_all_admin"
  ON public.vendedor_performance_mensal FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_vendedor_performance_mensal_select_own"
  ON public.vendedor_performance_mensal FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND vendedor_id IN (
      SELECT v.id FROM vendedores v
      WHERE v.user_id = auth.uid() AND v.tenant_id = get_user_tenant_id()
    )
  );

-- C26: sla_breaches - JÁ TEM policies tenant-aware, apenas add DELETE
CREATE POLICY "rls_sla_breaches_delete_admin"
  ON public.sla_breaches FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));


-- ============================================================
-- CLASSE D: TENANT_OWNER_ONLY
-- Owner (user_id/instalador_id/created_by) + tenant
-- Admin override com tenant
-- ============================================================

-- D1: profiles (owner + admin)
CREATE POLICY "rls_profiles_select_own"
  ON public.profiles FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND user_id = auth.uid());
CREATE POLICY "rls_profiles_select_admin"
  ON public.profiles FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_profiles_insert_own"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
  -- Nota: tenant_id pode não estar definido no momento do primeiro insert
CREATE POLICY "rls_profiles_update_own"
  ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- D2: user_roles (owner read + admin manage)
CREATE POLICY "rls_user_roles_select_own"
  ON public.user_roles FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND user_id = auth.uid());
CREATE POLICY "rls_user_roles_all_admin"
  ON public.user_roles FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- D3: checklists_instalacao (instalador + admin)
CREATE POLICY "rls_checklists_instalacao_all_admin"
  ON public.checklists_instalacao FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_checklists_instalacao_all_own"
  ON public.checklists_instalacao FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND instalador_id = auth.uid())
  WITH CHECK (tenant_id = get_user_tenant_id() AND instalador_id = auth.uid());

-- D4: checklists_instalador (instalador S/U + admin ALL)
CREATE POLICY "rls_checklists_instalador_all_admin"
  ON public.checklists_instalador FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_checklists_instalador_select_own"
  ON public.checklists_instalador FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND instalador_id = auth.uid());
CREATE POLICY "rls_checklists_instalador_update_own"
  ON public.checklists_instalador FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id() AND instalador_id = auth.uid())
  WITH CHECK (tenant_id = get_user_tenant_id() AND instalador_id = auth.uid());

-- D5: checklist_instalador_arquivos (uploaded_by + admin)
CREATE POLICY "rls_checklist_instalador_arquivos_all_admin"
  ON public.checklist_instalador_arquivos FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_checklist_instalador_arquivos_all_own"
  ON public.checklist_instalador_arquivos FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND uploaded_by = auth.uid())
  WITH CHECK (tenant_id = get_user_tenant_id() AND uploaded_by = auth.uid());

-- D6: checklist_instalador_respostas (respondido_por + admin)
CREATE POLICY "rls_checklist_instalador_respostas_all_admin"
  ON public.checklist_instalador_respostas FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_checklist_instalador_respostas_all_own"
  ON public.checklist_instalador_respostas FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND respondido_por = auth.uid())
  WITH CHECK (tenant_id = get_user_tenant_id() AND respondido_por = auth.uid());

-- D7: layouts_solares (created_by + admin)
CREATE POLICY "rls_layouts_solares_all_admin"
  ON public.layouts_solares FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_layouts_solares_all_own"
  ON public.layouts_solares FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND created_by = auth.uid())
  WITH CHECK (tenant_id = get_user_tenant_id() AND created_by = auth.uid());

-- D8: whatsapp_reminders (created_by + admin)
CREATE POLICY "rls_whatsapp_reminders_all_admin"
  ON public.whatsapp_reminders FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_whatsapp_reminders_all_own"
  ON public.whatsapp_reminders FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND created_by = auth.uid())
  WITH CHECK (tenant_id = get_user_tenant_id() AND created_by = auth.uid());


-- ============================================================
-- CLASSE E: SERVICE_ONLY + ADMIN_READ
-- Escrita via service_role (edge functions). Admin pode ler.
-- ============================================================

-- E1: instagram_posts (service write, admin manage, public read)
CREATE POLICY "rls_instagram_posts_select_public"
  ON public.instagram_posts FOR SELECT TO anon, authenticated
  USING (true); -- Posts públicos do Instagram. Frontend filtra.
CREATE POLICY "rls_instagram_posts_all_admin"
  ON public.instagram_posts FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
-- service_role para instagram-sync edge function
CREATE POLICY "rls_instagram_posts_service"
  ON public.instagram_posts FOR ALL TO service_role
  USING (true) WITH CHECK (tenant_id IS NOT NULL);

-- E2: solar_market_clients
CREATE POLICY "rls_solar_market_clients_select_admin"
  ON public.solar_market_clients FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_solar_market_clients_service"
  ON public.solar_market_clients FOR ALL TO service_role
  USING (true) WITH CHECK (tenant_id IS NOT NULL);

-- E3: solar_market_custom_fields
CREATE POLICY "rls_solar_market_custom_fields_select_admin"
  ON public.solar_market_custom_fields FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_solar_market_custom_fields_service"
  ON public.solar_market_custom_fields FOR ALL TO service_role
  USING (true) WITH CHECK (tenant_id IS NOT NULL);

-- E4: solar_market_custom_fields_catalog
CREATE POLICY "rls_solar_market_custom_fields_catalog_select_admin"
  ON public.solar_market_custom_fields_catalog FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_solar_market_custom_fields_catalog_service"
  ON public.solar_market_custom_fields_catalog FOR ALL TO service_role
  USING (true) WITH CHECK (tenant_id IS NOT NULL);

-- E5: solar_market_funnels
CREATE POLICY "rls_solar_market_funnels_select_admin"
  ON public.solar_market_funnels FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_solar_market_funnels_service"
  ON public.solar_market_funnels FOR ALL TO service_role
  USING (true) WITH CHECK (tenant_id IS NOT NULL);

-- E6: solar_market_funnels_catalog
CREATE POLICY "rls_solar_market_funnels_catalog_select_admin"
  ON public.solar_market_funnels_catalog FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_solar_market_funnels_catalog_service"
  ON public.solar_market_funnels_catalog FOR ALL TO service_role
  USING (true) WITH CHECK (tenant_id IS NOT NULL);

-- E7: solar_market_integration_requests
-- CORREÇÃO: remover INSERT público aberto (WITH CHECK true)
CREATE POLICY "rls_solar_market_integration_requests_select_admin"
  ON public.solar_market_integration_requests FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_solar_market_integration_requests_service"
  ON public.solar_market_integration_requests FOR ALL TO service_role
  USING (true) WITH CHECK (tenant_id IS NOT NULL);

-- E8: solar_market_projects
CREATE POLICY "rls_solar_market_projects_select_admin"
  ON public.solar_market_projects FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_solar_market_projects_service"
  ON public.solar_market_projects FOR ALL TO service_role
  USING (true) WITH CHECK (tenant_id IS NOT NULL);

-- E9: solar_market_proposals
CREATE POLICY "rls_solar_market_proposals_select_admin"
  ON public.solar_market_proposals FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_solar_market_proposals_service"
  ON public.solar_market_proposals FOR ALL TO service_role
  USING (true) WITH CHECK (tenant_id IS NOT NULL);

-- E10: solar_market_sync_items_failed
-- CORREÇÃO: remover INSERT público aberto (WITH CHECK true)
CREATE POLICY "rls_solar_market_sync_items_failed_select_admin"
  ON public.solar_market_sync_items_failed FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_solar_market_sync_items_failed_service"
  ON public.solar_market_sync_items_failed FOR ALL TO service_role
  USING (true) WITH CHECK (tenant_id IS NOT NULL);

-- E11: solar_market_sync_logs
CREATE POLICY "rls_solar_market_sync_logs_select_admin"
  ON public.solar_market_sync_logs FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_solar_market_sync_logs_service"
  ON public.solar_market_sync_logs FOR ALL TO service_role
  USING (true) WITH CHECK (tenant_id IS NOT NULL);

-- E12: solar_market_users
CREATE POLICY "rls_solar_market_users_select_admin"
  ON public.solar_market_users FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_solar_market_users_service"
  ON public.solar_market_users FOR ALL TO service_role
  USING (true) WITH CHECK (tenant_id IS NOT NULL);

-- E13: solar_market_webhook_events
CREATE POLICY "rls_solar_market_webhook_events_select_admin"
  ON public.solar_market_webhook_events FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_solar_market_webhook_events_service"
  ON public.solar_market_webhook_events FOR ALL TO service_role
  USING (true) WITH CHECK (tenant_id IS NOT NULL);


-- ============================================================
-- CLASSE F: WHATSAPP_HYBRID
-- Admin + Vendedor via instância/conversa, sempre com tenant
-- ============================================================

-- F1: wa_instances (admin + owner)
CREATE POLICY "rls_wa_instances_all_admin"
  ON public.wa_instances FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_wa_instances_select_owner"
  ON public.wa_instances FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND owner_user_id = auth.uid());
-- service_role para edge functions (evolution-webhook, etc.)
CREATE POLICY "rls_wa_instances_service"
  ON public.wa_instances FOR ALL TO service_role
  USING (true) WITH CHECK (tenant_id IS NOT NULL);

-- F2: wa_conversations (admin + vendor via instance/assigned)
CREATE POLICY "rls_wa_conversations_all_admin"
  ON public.wa_conversations FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_wa_conversations_select_vendor"
  ON public.wa_conversations FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND (
      assigned_to = auth.uid()
      OR EXISTS (
        SELECT 1 FROM wa_instances wi
        WHERE wi.id = wa_conversations.instance_id
          AND wi.owner_user_id = auth.uid()
          AND wi.tenant_id = get_user_tenant_id()
      )
    )
  );
CREATE POLICY "rls_wa_conversations_update_vendor"
  ON public.wa_conversations FOR UPDATE TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND (
      assigned_to = auth.uid()
      OR EXISTS (
        SELECT 1 FROM wa_instances wi
        WHERE wi.id = wa_conversations.instance_id
          AND wi.owner_user_id = auth.uid()
          AND wi.tenant_id = get_user_tenant_id()
      )
    )
  );
CREATE POLICY "rls_wa_conversations_service"
  ON public.wa_conversations FOR ALL TO service_role
  USING (true) WITH CHECK (tenant_id IS NOT NULL);

-- F3: wa_messages (admin + vendor via conversation)
CREATE POLICY "rls_wa_messages_all_admin"
  ON public.wa_messages FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_wa_messages_select_vendor"
  ON public.wa_messages FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM wa_conversations wc
      JOIN wa_instances wi ON wi.id = wc.instance_id
      WHERE wc.id = wa_messages.conversation_id
        AND wc.tenant_id = get_user_tenant_id()
        AND (wi.owner_user_id = auth.uid() OR wc.assigned_to = auth.uid())
    )
  );
CREATE POLICY "rls_wa_messages_insert_vendor"
  ON public.wa_messages FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM wa_conversations wc
      JOIN wa_instances wi ON wi.id = wc.instance_id
      WHERE wc.id = wa_messages.conversation_id
        AND wc.tenant_id = get_user_tenant_id()
        AND (wi.owner_user_id = auth.uid() OR wc.assigned_to = auth.uid())
    )
  );
CREATE POLICY "rls_wa_messages_service"
  ON public.wa_messages FOR ALL TO service_role
  USING (true) WITH CHECK (tenant_id IS NOT NULL);

-- F4: wa_outbox (admin + vendor via instance)
CREATE POLICY "rls_wa_outbox_all_admin"
  ON public.wa_outbox FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_wa_outbox_select_vendor"
  ON public.wa_outbox FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM wa_instances wi
      WHERE wi.id = wa_outbox.instance_id
        AND wi.owner_user_id = auth.uid()
        AND wi.tenant_id = get_user_tenant_id()
    )
  );
CREATE POLICY "rls_wa_outbox_insert_vendor"
  ON public.wa_outbox FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM wa_instances wi
      WHERE wi.id = wa_outbox.instance_id
        AND wi.owner_user_id = auth.uid()
        AND wi.tenant_id = get_user_tenant_id()
    )
  );
CREATE POLICY "rls_wa_outbox_service"
  ON public.wa_outbox FOR ALL TO service_role
  USING (true) WITH CHECK (tenant_id IS NOT NULL);

-- F5: wa_transfers (admin + from/to user)
CREATE POLICY "rls_wa_transfers_all_admin"
  ON public.wa_transfers FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_wa_transfers_select_user"
  ON public.wa_transfers FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND (from_user_id = auth.uid() OR to_user_id = auth.uid())
  );
CREATE POLICY "rls_wa_transfers_service"
  ON public.wa_transfers FOR ALL TO service_role
  USING (true) WITH CHECK (tenant_id IS NOT NULL);

-- F6: whatsapp_conversations (legacy system - admin + assigned)
CREATE POLICY "rls_whatsapp_conversations_all_admin"
  ON public.whatsapp_conversations FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_whatsapp_conversations_select_assigned"
  ON public.whatsapp_conversations FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND assigned_to = auth.uid());
CREATE POLICY "rls_whatsapp_conversations_update_assigned"
  ON public.whatsapp_conversations FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id() AND assigned_to = auth.uid())
  WITH CHECK (tenant_id = get_user_tenant_id() AND assigned_to = auth.uid());

-- F7: whatsapp_conversation_messages (admin + vendor via conversation)
CREATE POLICY "rls_whatsapp_conversation_messages_all_admin"
  ON public.whatsapp_conversation_messages FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_whatsapp_conversation_messages_select_vendor"
  ON public.whatsapp_conversation_messages FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND conversation_id IN (
      SELECT wc.id FROM whatsapp_conversations wc
      WHERE wc.assigned_to = auth.uid() AND wc.tenant_id = get_user_tenant_id()
    )
  );
CREATE POLICY "rls_whatsapp_conversation_messages_insert_vendor"
  ON public.whatsapp_conversation_messages FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND conversation_id IN (
      SELECT wc.id FROM whatsapp_conversations wc
      WHERE wc.assigned_to = auth.uid() AND wc.tenant_id = get_user_tenant_id()
    )
  );

-- F8: whatsapp_transfers (admin + from/to)
CREATE POLICY "rls_whatsapp_transfers_all_admin"
  ON public.whatsapp_transfers FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_whatsapp_transfers_select_user"
  ON public.whatsapp_transfers FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND (from_user_id = auth.uid() OR to_user_id = auth.uid())
  );


-- ============================================================
-- CLASSE G: PUBLIC_INSERT (formulários anônimos)
-- Já tratado em C1 (leads), C2 (orcamentos). Falta simulacoes.
-- ============================================================

-- G1: simulacoes (admin read + public insert)
CREATE POLICY "rls_simulacoes_all_admin"
  ON public.simulacoes FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
-- Insert público - manter validação existente
CREATE POLICY "rls_simulacoes_insert_public"
  ON public.simulacoes FOR INSERT TO anon
  WITH CHECK (consumo_kwh IS NOT NULL AND consumo_kwh > 0);


-- ============================================================
-- CLASSE H: SITE_PUBLIC (conteúdo público do site)
-- site_banners e site_settings JÁ estão corretos.
-- ============================================================

-- H1: site_servicos (public read, admin write com tenant)
CREATE POLICY "rls_site_servicos_select_public"
  ON public.site_servicos FOR SELECT TO anon, authenticated
  USING (true); -- Serviços públicos do site.
CREATE POLICY "rls_site_servicos_all_admin"
  ON public.site_servicos FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));


-- ============================================================
-- TABELAS SEM tenant_id (gap documentado)
-- Usar filtro baseado em join com tabela parent
-- ============================================================

-- wa_conversation_tags (sem tenant_id - usar join com conversations)
-- NOTA: Não é possível filtrar por tenant diretamente. A policy
-- atual já filtra via conversation→instance. Adicionaremos tenant_id
-- na Fase 3. Por ora, mantemos as policies existentes.

-- whatsapp_conversation_tags (sem tenant_id - mesma situação)
-- Mantemos policies existentes.

-- backfill_audit (tabela interna, admin-only, sem tenant_id padrão)
-- Mantemos policy existente.

COMMIT;
