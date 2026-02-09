
-- ================================================================
-- MIGRATION 003 v2: PRÉ-REQUISITOS + POLICIES TENANT-AWARE
-- Fase 0.2 do Plano de Endurecimento Multi-Tenant
-- ================================================================

-- ================================================================
-- PRÉ-REQUISITO 1: Função de resolução de tenant para inserts anônimos
-- ================================================================

CREATE OR REPLACE FUNCTION public.resolve_public_tenant_id()
  RETURNS uuid
  LANGUAGE plpgsql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  _tenant uuid;
  _count integer;
BEGIN
  SELECT COUNT(*) INTO _count FROM tenants WHERE ativo = true;

  IF _count = 0 THEN
    RAISE EXCEPTION 'resolve_public_tenant_id: nenhum tenant ativo encontrado'
      USING ERRCODE = 'P0402';
  END IF;

  IF _count > 1 THEN
    RAISE EXCEPTION 'resolve_public_tenant_id: múltiplos tenants ativos (%). Inserts anônimos devem resolver tenant via vendedor/link.', _count
      USING ERRCODE = 'P0402';
  END IF;

  SELECT id INTO _tenant FROM tenants WHERE ativo = true LIMIT 1;
  RETURN _tenant;
END;
$$;

COMMENT ON FUNCTION resolve_public_tenant_id IS
  'Retorna o único tenant ativo. Falha se 0 ou >1. Para inserts anônimos sem contexto de vendedor.';


-- ================================================================
-- PRÉ-REQUISITO 2: Triggers de resolução de tenant_id para INSERTs anônimos
-- ================================================================

-- === LEADS ===
CREATE OR REPLACE FUNCTION public.resolve_lead_tenant_id()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  _resolved uuid;
BEGIN
  IF NEW.tenant_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    _resolved := get_user_tenant_id();
    IF _resolved IS NOT NULL THEN
      NEW.tenant_id := _resolved;
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.vendedor IS NOT NULL AND TRIM(NEW.vendedor) != '' THEN
    SELECT v.tenant_id INTO _resolved
    FROM vendedores v
    WHERE (v.codigo = NEW.vendedor OR v.slug = NEW.vendedor OR v.nome = NEW.vendedor)
      AND v.ativo = true
    LIMIT 1;

    IF _resolved IS NOT NULL THEN
      NEW.tenant_id := _resolved;
      RETURN NEW;
    END IF;
  END IF;

  NEW.tenant_id := resolve_public_tenant_id();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS resolve_lead_tenant_id_trg ON public.leads;
CREATE TRIGGER resolve_lead_tenant_id_trg
  BEFORE INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION resolve_lead_tenant_id();


-- === ORCAMENTOS ===
CREATE OR REPLACE FUNCTION public.resolve_orc_tenant_id()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  _resolved uuid;
BEGIN
  IF NEW.tenant_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    _resolved := get_user_tenant_id();
    IF _resolved IS NOT NULL THEN
      NEW.tenant_id := _resolved;
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.lead_id IS NOT NULL THEN
    SELECT l.tenant_id INTO _resolved
    FROM leads l
    WHERE l.id = NEW.lead_id
    LIMIT 1;

    IF _resolved IS NOT NULL THEN
      NEW.tenant_id := _resolved;
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.vendedor IS NOT NULL AND TRIM(NEW.vendedor) != '' THEN
    SELECT v.tenant_id INTO _resolved
    FROM vendedores v
    WHERE (v.codigo = NEW.vendedor OR v.slug = NEW.vendedor OR v.nome = NEW.vendedor)
      AND v.ativo = true
    LIMIT 1;

    IF _resolved IS NOT NULL THEN
      NEW.tenant_id := _resolved;
      RETURN NEW;
    END IF;
  END IF;

  NEW.tenant_id := resolve_public_tenant_id();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS resolve_orc_tenant_id_trg ON public.orcamentos;
CREATE TRIGGER resolve_orc_tenant_id_trg
  BEFORE INSERT ON public.orcamentos
  FOR EACH ROW
  EXECUTE FUNCTION resolve_orc_tenant_id();


-- === SIMULACOES ===
CREATE OR REPLACE FUNCTION public.resolve_sim_tenant_id()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.tenant_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    NEW.tenant_id := get_user_tenant_id();
    IF NEW.tenant_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  NEW.tenant_id := resolve_public_tenant_id();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS resolve_sim_tenant_id_trg ON public.simulacoes;
CREATE TRIGGER resolve_sim_tenant_id_trg
  BEFORE INSERT ON public.simulacoes
  FOR EACH ROW
  EXECUTE FUNCTION resolve_sim_tenant_id();


-- ================================================================
-- PRÉ-REQUISITO 3: Alterar DEFAULTs das tabelas com insert anônimo
-- ================================================================

ALTER TABLE public.leads ALTER COLUMN tenant_id SET DEFAULT NULL;
ALTER TABLE public.orcamentos ALTER COLUMN tenant_id SET DEFAULT NULL;
ALTER TABLE public.simulacoes ALTER COLUMN tenant_id SET DEFAULT NULL;


-- ============================================================
-- CLASSE A: TENANT_ADMIN_ONLY
-- ============================================================

CREATE POLICY "rls_ai_insights_all_admin"
  ON public.ai_insights FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

CREATE POLICY "rls_audit_logs_select_admin"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_audit_logs_service"
  ON public.audit_logs FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "rls_calculadora_config_all_admin"
  ON public.calculadora_config FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

CREATE POLICY "rls_financiamento_api_config_all_admin"
  ON public.financiamento_api_config FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

CREATE POLICY "rls_instagram_config_all_admin"
  ON public.instagram_config FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

CREATE POLICY "rls_pagamentos_all_admin"
  ON public.pagamentos FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

CREATE POLICY "rls_pagamentos_comissao_all_admin"
  ON public.pagamentos_comissao FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

CREATE POLICY "rls_parcelas_all_admin"
  ON public.parcelas FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

CREATE POLICY "rls_recebimentos_all_admin"
  ON public.recebimentos FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

CREATE POLICY "rls_release_checklists_all_admin"
  ON public.release_checklists FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

CREATE POLICY "rls_solar_market_config_all_admin"
  ON public.solar_market_config FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

CREATE POLICY "rls_webhook_config_all_admin"
  ON public.webhook_config FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

CREATE POLICY "rls_whatsapp_automation_config_all_admin"
  ON public.whatsapp_automation_config FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

CREATE POLICY "rls_whatsapp_automation_logs_all_admin"
  ON public.whatsapp_automation_logs FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_whatsapp_automation_logs_service"
  ON public.whatsapp_automation_logs FOR ALL TO service_role
  USING (true) WITH CHECK (tenant_id IS NOT NULL);

CREATE POLICY "rls_whatsapp_messages_all_admin"
  ON public.whatsapp_messages FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_whatsapp_messages_service"
  ON public.whatsapp_messages FOR ALL TO service_role
  USING (true) WITH CHECK (tenant_id IS NOT NULL);

CREATE POLICY "rls_wa_webhook_events_all_admin"
  ON public.wa_webhook_events FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_wa_webhook_events_service"
  ON public.wa_webhook_events FOR ALL TO service_role
  USING (true) WITH CHECK (tenant_id IS NOT NULL);


-- ============================================================
-- CLASSE B: TENANT_USER_READ + ADMIN_WRITE
-- ============================================================

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

CREATE POLICY "rls_brand_settings_select_public"
  ON public.brand_settings FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY "rls_brand_settings_all_admin"
  ON public.brand_settings FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

CREATE POLICY "rls_checklist_template_items_select_tenant"
  ON public.checklist_template_items FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "rls_checklist_template_items_all_admin"
  ON public.checklist_template_items FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

CREATE POLICY "rls_checklist_templates_select_tenant"
  ON public.checklist_templates FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND ativo = true);
CREATE POLICY "rls_checklist_templates_all_admin"
  ON public.checklist_templates FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

CREATE POLICY "rls_concessionarias_select_anon"
  ON public.concessionarias FOR SELECT TO anon
  USING (ativo = true);
CREATE POLICY "rls_concessionarias_select_tenant"
  ON public.concessionarias FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "rls_concessionarias_all_admin"
  ON public.concessionarias FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

CREATE POLICY "rls_config_tributaria_estado_select_public"
  ON public.config_tributaria_estado FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY "rls_config_tributaria_estado_all_admin"
  ON public.config_tributaria_estado FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

CREATE POLICY "rls_disjuntores_select_tenant"
  ON public.disjuntores FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "rls_disjuntores_all_admin"
  ON public.disjuntores FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

CREATE POLICY "rls_financiamento_bancos_all_admin"
  ON public.financiamento_bancos FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

CREATE POLICY "rls_fio_b_escalonamento_select_public"
  ON public.fio_b_escalonamento FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY "rls_fio_b_escalonamento_all_admin"
  ON public.fio_b_escalonamento FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

CREATE POLICY "rls_gamification_config_select_tenant"
  ON public.gamification_config FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "rls_gamification_config_all_admin"
  ON public.gamification_config FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

CREATE POLICY "rls_instalador_config_select_tenant"
  ON public.instalador_config FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "rls_instalador_config_all_admin"
  ON public.instalador_config FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

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

CREATE POLICY "rls_lead_scoring_config_select_tenant"
  ON public.lead_scoring_config FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "rls_lead_scoring_config_all_admin"
  ON public.lead_scoring_config FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

CREATE POLICY "rls_lead_status_select_tenant"
  ON public.lead_status FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "rls_lead_status_all_admin"
  ON public.lead_status FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

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

CREATE POLICY "rls_payback_config_select_public"
  ON public.payback_config FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY "rls_payback_config_all_admin"
  ON public.payback_config FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

CREATE POLICY "rls_proposal_variables_select_tenant"
  ON public.proposal_variables FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "rls_proposal_variables_all_admin"
  ON public.proposal_variables FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

CREATE POLICY "rls_sla_rules_select_tenant"
  ON public.sla_rules FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "rls_sla_rules_all_admin"
  ON public.sla_rules FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

CREATE POLICY "rls_transformadores_select_tenant"
  ON public.transformadores FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "rls_transformadores_all_admin"
  ON public.transformadores FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

CREATE POLICY "rls_vendedores_select_tenant"
  ON public.vendedores FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "rls_vendedores_select_anon"
  ON public.vendedores FOR SELECT TO anon
  USING (ativo = true);
CREATE POLICY "rls_vendedores_all_admin"
  ON public.vendedores FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

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

CREATE POLICY "rls_wa_quick_reply_categories_select_tenant"
  ON public.wa_quick_reply_categories FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "rls_wa_quick_reply_categories_all_admin"
  ON public.wa_quick_reply_categories FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

CREATE POLICY "rls_wa_tags_select_tenant"
  ON public.wa_tags FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "rls_wa_tags_all_admin"
  ON public.wa_tags FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

CREATE POLICY "rls_whatsapp_automation_templates_select_tenant"
  ON public.whatsapp_automation_templates FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "rls_whatsapp_automation_templates_all_admin"
  ON public.whatsapp_automation_templates FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

CREATE POLICY "rls_whatsapp_tags_select_tenant"
  ON public.whatsapp_tags FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "rls_whatsapp_tags_all_admin"
  ON public.whatsapp_tags FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));


-- ============================================================
-- CLASSE C: TENANT_HYBRID
-- ============================================================

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
CREATE POLICY "rls_leads_insert_public"
  ON public.leads FOR INSERT TO anon
  WITH CHECK (
    tenant_id IS NOT NULL
    AND nome IS NOT NULL AND length(TRIM(BOTH FROM nome)) >= 2
    AND telefone IS NOT NULL AND length(TRIM(BOTH FROM telefone)) >= 10
    AND cidade IS NOT NULL AND estado IS NOT NULL
    AND area IS NOT NULL AND tipo_telhado IS NOT NULL
    AND rede_atendimento IS NOT NULL
    AND media_consumo IS NOT NULL AND media_consumo >= 0
    AND consumo_previsto IS NOT NULL AND consumo_previsto >= 0
    AND visto = false AND visto_admin = false
    AND status_id IS NULL AND observacoes IS NULL AND lead_code IS NULL
  );

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
CREATE POLICY "rls_orcamentos_insert_public"
  ON public.orcamentos FOR INSERT TO anon
  WITH CHECK (
    tenant_id IS NOT NULL
    AND lead_id IS NOT NULL AND tipo_telhado IS NOT NULL
    AND area IS NOT NULL AND estado IS NOT NULL AND cidade IS NOT NULL
    AND rede_atendimento IS NOT NULL
    AND media_consumo IS NOT NULL AND media_consumo > 0
    AND consumo_previsto IS NOT NULL AND consumo_previsto > 0
    AND visto = false AND visto_admin = false
    AND status_id IS NULL AND observacoes IS NULL AND orc_code IS NULL
  );

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

CREATE POLICY "rls_lead_atividades_all_admin"
  ON public.lead_atividades FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_lead_atividades_all_owner"
  ON public.lead_atividades FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND created_by = auth.uid())
  WITH CHECK (tenant_id = get_user_tenant_id() AND created_by = auth.uid());

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

CREATE POLICY "rls_lead_links_all_admin"
  ON public.lead_links FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_lead_links_service"
  ON public.lead_links FOR ALL TO service_role
  USING (true) WITH CHECK (tenant_id IS NOT NULL);

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

CREATE POLICY "rls_checklists_cliente_all_admin"
  ON public.checklists_cliente FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

CREATE POLICY "rls_checklist_cliente_arquivos_all_admin"
  ON public.checklist_cliente_arquivos FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

CREATE POLICY "rls_checklist_cliente_respostas_all_admin"
  ON public.checklist_cliente_respostas FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

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

CREATE POLICY "rls_obras_all_admin"
  ON public.obras FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_obras_select_public"
  ON public.obras FOR SELECT TO anon, authenticated
  USING (ativo = true);

CREATE POLICY "rls_instalador_metas_all_admin"
  ON public.instalador_metas FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_instalador_metas_select_own"
  ON public.instalador_metas FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND instalador_id = auth.uid());

CREATE POLICY "rls_instalador_performance_mensal_all_admin"
  ON public.instalador_performance_mensal FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_instalador_performance_mensal_select_own"
  ON public.instalador_performance_mensal FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND instalador_id = auth.uid());

CREATE POLICY "rls_vendedor_achievements_all_admin"
  ON public.vendedor_achievements FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_vendedor_achievements_select_own"
  ON public.vendedor_achievements FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND vendedor_id IN (SELECT v.id FROM vendedores v WHERE v.user_id = auth.uid() AND v.tenant_id = get_user_tenant_id()));

CREATE POLICY "rls_vendedor_metas_all_admin"
  ON public.vendedor_metas FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_vendedor_metas_select_own"
  ON public.vendedor_metas FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND vendedor_id IN (SELECT v.id FROM vendedores v WHERE v.user_id = auth.uid() AND v.tenant_id = get_user_tenant_id()));

CREATE POLICY "rls_vendedor_metricas_all_admin"
  ON public.vendedor_metricas FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_vendedor_metricas_select_own"
  ON public.vendedor_metricas FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND vendedor_id IN (SELECT v.id FROM vendedores v WHERE v.user_id = auth.uid() AND v.tenant_id = get_user_tenant_id()));

CREATE POLICY "rls_vendedor_performance_mensal_all_admin"
  ON public.vendedor_performance_mensal FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_vendedor_performance_mensal_select_own"
  ON public.vendedor_performance_mensal FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND vendedor_id IN (SELECT v.id FROM vendedores v WHERE v.user_id = auth.uid() AND v.tenant_id = get_user_tenant_id()));

CREATE POLICY "rls_sla_breaches_delete_admin"
  ON public.sla_breaches FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));


-- ============================================================
-- CLASSE D: TENANT_OWNER_ONLY
-- ============================================================

CREATE POLICY "rls_profiles_select_own"
  ON public.profiles FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND user_id = auth.uid());
CREATE POLICY "rls_profiles_select_admin"
  ON public.profiles FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_profiles_insert_own"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "rls_profiles_update_own"
  ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "rls_user_roles_select_own"
  ON public.user_roles FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND user_id = auth.uid());
CREATE POLICY "rls_user_roles_all_admin"
  ON public.user_roles FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

CREATE POLICY "rls_checklists_instalacao_all_admin"
  ON public.checklists_instalacao FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_checklists_instalacao_all_own"
  ON public.checklists_instalacao FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND instalador_id = auth.uid())
  WITH CHECK (tenant_id = get_user_tenant_id() AND instalador_id = auth.uid());

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

CREATE POLICY "rls_checklist_instalador_arquivos_all_admin"
  ON public.checklist_instalador_arquivos FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_checklist_instalador_arquivos_all_own"
  ON public.checklist_instalador_arquivos FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND uploaded_by = auth.uid())
  WITH CHECK (tenant_id = get_user_tenant_id() AND uploaded_by = auth.uid());

CREATE POLICY "rls_checklist_instalador_respostas_all_admin"
  ON public.checklist_instalador_respostas FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_checklist_instalador_respostas_all_own"
  ON public.checklist_instalador_respostas FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND respondido_por = auth.uid())
  WITH CHECK (tenant_id = get_user_tenant_id() AND respondido_por = auth.uid());

CREATE POLICY "rls_layouts_solares_all_admin"
  ON public.layouts_solares FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_layouts_solares_all_own"
  ON public.layouts_solares FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND created_by = auth.uid())
  WITH CHECK (tenant_id = get_user_tenant_id() AND created_by = auth.uid());

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
-- ============================================================

CREATE POLICY "rls_instagram_posts_select_public"
  ON public.instagram_posts FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY "rls_instagram_posts_all_admin"
  ON public.instagram_posts FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_instagram_posts_service"
  ON public.instagram_posts FOR ALL TO service_role
  USING (true) WITH CHECK (tenant_id IS NOT NULL);

CREATE POLICY "rls_solar_market_clients_select_admin"
  ON public.solar_market_clients FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_solar_market_clients_service"
  ON public.solar_market_clients FOR ALL TO service_role
  USING (true) WITH CHECK (tenant_id IS NOT NULL);

CREATE POLICY "rls_solar_market_custom_fields_select_admin"
  ON public.solar_market_custom_fields FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_solar_market_custom_fields_service"
  ON public.solar_market_custom_fields FOR ALL TO service_role
  USING (true) WITH CHECK (tenant_id IS NOT NULL);

CREATE POLICY "rls_solar_market_custom_fields_catalog_select_admin"
  ON public.solar_market_custom_fields_catalog FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_solar_market_custom_fields_catalog_service"
  ON public.solar_market_custom_fields_catalog FOR ALL TO service_role
  USING (true) WITH CHECK (tenant_id IS NOT NULL);

CREATE POLICY "rls_solar_market_funnels_select_admin"
  ON public.solar_market_funnels FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_solar_market_funnels_service"
  ON public.solar_market_funnels FOR ALL TO service_role
  USING (true) WITH CHECK (tenant_id IS NOT NULL);

CREATE POLICY "rls_solar_market_funnels_catalog_select_admin"
  ON public.solar_market_funnels_catalog FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_solar_market_funnels_catalog_service"
  ON public.solar_market_funnels_catalog FOR ALL TO service_role
  USING (true) WITH CHECK (tenant_id IS NOT NULL);

CREATE POLICY "rls_solar_market_integration_requests_select_admin"
  ON public.solar_market_integration_requests FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_solar_market_integration_requests_service"
  ON public.solar_market_integration_requests FOR ALL TO service_role
  USING (true) WITH CHECK (tenant_id IS NOT NULL);

CREATE POLICY "rls_solar_market_projects_select_admin"
  ON public.solar_market_projects FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_solar_market_projects_service"
  ON public.solar_market_projects FOR ALL TO service_role
  USING (true) WITH CHECK (tenant_id IS NOT NULL);

CREATE POLICY "rls_solar_market_proposals_select_admin"
  ON public.solar_market_proposals FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_solar_market_proposals_service"
  ON public.solar_market_proposals FOR ALL TO service_role
  USING (true) WITH CHECK (tenant_id IS NOT NULL);

CREATE POLICY "rls_solar_market_sync_items_failed_select_admin"
  ON public.solar_market_sync_items_failed FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_solar_market_sync_items_failed_service"
  ON public.solar_market_sync_items_failed FOR ALL TO service_role
  USING (true) WITH CHECK (tenant_id IS NOT NULL);

CREATE POLICY "rls_solar_market_sync_logs_select_admin"
  ON public.solar_market_sync_logs FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_solar_market_sync_logs_service"
  ON public.solar_market_sync_logs FOR ALL TO service_role
  USING (true) WITH CHECK (tenant_id IS NOT NULL);

CREATE POLICY "rls_solar_market_users_select_admin"
  ON public.solar_market_users FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_solar_market_users_service"
  ON public.solar_market_users FOR ALL TO service_role
  USING (true) WITH CHECK (tenant_id IS NOT NULL);

CREATE POLICY "rls_solar_market_webhook_events_select_admin"
  ON public.solar_market_webhook_events FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_solar_market_webhook_events_service"
  ON public.solar_market_webhook_events FOR ALL TO service_role
  USING (true) WITH CHECK (tenant_id IS NOT NULL);


-- ============================================================
-- CLASSE F: WHATSAPP_HYBRID
-- ============================================================

CREATE POLICY "rls_wa_instances_all_admin"
  ON public.wa_instances FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_wa_instances_select_owner"
  ON public.wa_instances FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND owner_user_id = auth.uid());
CREATE POLICY "rls_wa_instances_service"
  ON public.wa_instances FOR ALL TO service_role
  USING (true) WITH CHECK (tenant_id IS NOT NULL);

CREATE POLICY "rls_wa_conversations_all_admin"
  ON public.wa_conversations FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_wa_conversations_select_vendor"
  ON public.wa_conversations FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND (assigned_to = auth.uid() OR EXISTS (SELECT 1 FROM wa_instances wi WHERE wi.id = wa_conversations.instance_id AND wi.owner_user_id = auth.uid() AND wi.tenant_id = get_user_tenant_id())));
CREATE POLICY "rls_wa_conversations_update_vendor"
  ON public.wa_conversations FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id() AND (assigned_to = auth.uid() OR EXISTS (SELECT 1 FROM wa_instances wi WHERE wi.id = wa_conversations.instance_id AND wi.owner_user_id = auth.uid() AND wi.tenant_id = get_user_tenant_id())));
CREATE POLICY "rls_wa_conversations_service"
  ON public.wa_conversations FOR ALL TO service_role
  USING (true) WITH CHECK (tenant_id IS NOT NULL);

CREATE POLICY "rls_wa_messages_all_admin"
  ON public.wa_messages FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_wa_messages_select_vendor"
  ON public.wa_messages FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND EXISTS (SELECT 1 FROM wa_conversations wc JOIN wa_instances wi ON wi.id = wc.instance_id WHERE wc.id = wa_messages.conversation_id AND wc.tenant_id = get_user_tenant_id() AND (wi.owner_user_id = auth.uid() OR wc.assigned_to = auth.uid())));
CREATE POLICY "rls_wa_messages_insert_vendor"
  ON public.wa_messages FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id() AND EXISTS (SELECT 1 FROM wa_conversations wc JOIN wa_instances wi ON wi.id = wc.instance_id WHERE wc.id = wa_messages.conversation_id AND wc.tenant_id = get_user_tenant_id() AND (wi.owner_user_id = auth.uid() OR wc.assigned_to = auth.uid())));
CREATE POLICY "rls_wa_messages_service"
  ON public.wa_messages FOR ALL TO service_role
  USING (true) WITH CHECK (tenant_id IS NOT NULL);

CREATE POLICY "rls_wa_outbox_all_admin"
  ON public.wa_outbox FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_wa_outbox_select_vendor"
  ON public.wa_outbox FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND EXISTS (SELECT 1 FROM wa_instances wi WHERE wi.id = wa_outbox.instance_id AND wi.owner_user_id = auth.uid() AND wi.tenant_id = get_user_tenant_id()));
CREATE POLICY "rls_wa_outbox_insert_vendor"
  ON public.wa_outbox FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id() AND EXISTS (SELECT 1 FROM wa_instances wi WHERE wi.id = wa_outbox.instance_id AND wi.owner_user_id = auth.uid() AND wi.tenant_id = get_user_tenant_id()));
CREATE POLICY "rls_wa_outbox_service"
  ON public.wa_outbox FOR ALL TO service_role
  USING (true) WITH CHECK (tenant_id IS NOT NULL);

CREATE POLICY "rls_wa_transfers_all_admin"
  ON public.wa_transfers FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_wa_transfers_select_user"
  ON public.wa_transfers FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND (from_user_id = auth.uid() OR to_user_id = auth.uid()));
CREATE POLICY "rls_wa_transfers_service"
  ON public.wa_transfers FOR ALL TO service_role
  USING (true) WITH CHECK (tenant_id IS NOT NULL);

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

CREATE POLICY "rls_whatsapp_conversation_messages_all_admin"
  ON public.whatsapp_conversation_messages FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_whatsapp_conversation_messages_select_vendor"
  ON public.whatsapp_conversation_messages FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND conversation_id IN (SELECT wc.id FROM whatsapp_conversations wc WHERE wc.assigned_to = auth.uid() AND wc.tenant_id = get_user_tenant_id()));
CREATE POLICY "rls_whatsapp_conversation_messages_insert_vendor"
  ON public.whatsapp_conversation_messages FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id() AND conversation_id IN (SELECT wc.id FROM whatsapp_conversations wc WHERE wc.assigned_to = auth.uid() AND wc.tenant_id = get_user_tenant_id()));

CREATE POLICY "rls_whatsapp_transfers_all_admin"
  ON public.whatsapp_transfers FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_whatsapp_transfers_select_user"
  ON public.whatsapp_transfers FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND (from_user_id = auth.uid() OR to_user_id = auth.uid()));


-- ============================================================
-- CLASSE G: PUBLIC_INSERT
-- ============================================================

CREATE POLICY "rls_simulacoes_all_admin"
  ON public.simulacoes FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "rls_simulacoes_insert_public"
  ON public.simulacoes FOR INSERT TO anon
  WITH CHECK (
    tenant_id IS NOT NULL
    AND consumo_kwh IS NOT NULL AND consumo_kwh > 0
  );


-- ============================================================
-- CLASSE H: SITE_PUBLIC
-- ============================================================

CREATE POLICY "rls_site_servicos_select_public"
  ON public.site_servicos FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY "rls_site_servicos_all_admin"
  ON public.site_servicos FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
