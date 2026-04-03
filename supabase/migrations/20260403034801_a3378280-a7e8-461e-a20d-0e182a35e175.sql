
-- =============================================
-- FKs referencing CLIENTES (non-CASCADE → CASCADE)
-- =============================================
ALTER TABLE checklists_cliente DROP CONSTRAINT IF EXISTS checklists_cliente_cliente_id_fkey,
  ADD CONSTRAINT checklists_cliente_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
ALTER TABLE checklists_instalador DROP CONSTRAINT IF EXISTS checklists_instalador_cliente_id_fkey,
  ADD CONSTRAINT checklists_instalador_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
ALTER TABLE comissoes DROP CONSTRAINT IF EXISTS comissoes_cliente_id_fkey,
  ADD CONSTRAINT comissoes_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_linked_cliente_id_fkey,
  ADD CONSTRAINT contacts_linked_cliente_id_fkey FOREIGN KEY (linked_cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_customer_id_fkey,
  ADD CONSTRAINT deals_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES clientes(id) ON DELETE CASCADE;
ALTER TABLE fiscal_invoices DROP CONSTRAINT IF EXISTS fiscal_invoices_cliente_id_fkey,
  ADD CONSTRAINT fiscal_invoices_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
ALTER TABLE generated_documents DROP CONSTRAINT IF EXISTS generated_documents_cliente_id_fkey,
  ADD CONSTRAINT generated_documents_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
ALTER TABLE layouts_solares DROP CONSTRAINT IF EXISTS layouts_solares_cliente_id_fkey,
  ADD CONSTRAINT layouts_solares_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
ALTER TABLE monitor_subscriptions DROP CONSTRAINT IF EXISTS monitor_subscriptions_client_id_fkey,
  ADD CONSTRAINT monitor_subscriptions_client_id_fkey FOREIGN KEY (client_id) REFERENCES clientes(id) ON DELETE CASCADE;
ALTER TABLE os_instalacao DROP CONSTRAINT IF EXISTS os_instalacao_cliente_id_fkey,
  ADD CONSTRAINT os_instalacao_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
ALTER TABLE post_sale_plans DROP CONSTRAINT IF EXISTS post_sale_plans_cliente_id_fkey,
  ADD CONSTRAINT post_sale_plans_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
ALTER TABLE post_sale_upsell_opportunities DROP CONSTRAINT IF EXISTS post_sale_upsell_opportunities_cliente_id_fkey,
  ADD CONSTRAINT post_sale_upsell_opportunities_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
ALTER TABLE post_sale_visits DROP CONSTRAINT IF EXISTS post_sale_visits_cliente_id_fkey,
  ADD CONSTRAINT post_sale_visits_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
ALTER TABLE projetos DROP CONSTRAINT IF EXISTS fk_projetos_cliente,
  ADD CONSTRAINT fk_projetos_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
ALTER TABLE propostas_nativas DROP CONSTRAINT IF EXISTS fk_propostas_cliente,
  ADD CONSTRAINT fk_propostas_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
ALTER TABLE recebimentos DROP CONSTRAINT IF EXISTS recebimentos_cliente_id_fkey,
  ADD CONSTRAINT recebimentos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
ALTER TABLE servicos_agendados DROP CONSTRAINT IF EXISTS servicos_agendados_cliente_id_fkey,
  ADD CONSTRAINT servicos_agendados_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
ALTER TABLE vendas DROP CONSTRAINT IF EXISTS vendas_cliente_id_fkey,
  ADD CONSTRAINT vendas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
ALTER TABLE visitas_tecnicas DROP CONSTRAINT IF EXISTS visitas_tecnicas_cliente_id_fkey,
  ADD CONSTRAINT visitas_tecnicas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
ALTER TABLE whatsapp_automation_logs DROP CONSTRAINT IF EXISTS whatsapp_automation_logs_cliente_id_fkey,
  ADD CONSTRAINT whatsapp_automation_logs_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;

-- =============================================
-- FKs referencing DEALS
-- =============================================
ALTER TABLE deal_stage_history DROP CONSTRAINT IF EXISTS deal_stage_history_deal_id_fkey,
  ADD CONSTRAINT deal_stage_history_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
ALTER TABLE generated_documents DROP CONSTRAINT IF EXISTS generated_documents_deal_id_fkey,
  ADD CONSTRAINT generated_documents_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
ALTER TABLE projetos DROP CONSTRAINT IF EXISTS projetos_deal_id_fkey,
  ADD CONSTRAINT projetos_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE SET NULL;
ALTER TABLE propostas_nativas DROP CONSTRAINT IF EXISTS propostas_nativas_deal_id_fkey,
  ADD CONSTRAINT propostas_nativas_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE SET NULL;

-- =============================================
-- FKs referencing PROJETOS
-- =============================================
ALTER TABLE checklists_cliente DROP CONSTRAINT IF EXISTS checklists_cliente_projeto_id_fkey,
  ADD CONSTRAINT checklists_cliente_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE;
ALTER TABLE checklists_instalador DROP CONSTRAINT IF EXISTS checklists_instalador_projeto_id_fkey,
  ADD CONSTRAINT checklists_instalador_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE;
ALTER TABLE comissoes DROP CONSTRAINT IF EXISTS comissoes_projeto_id_fkey,
  ADD CONSTRAINT comissoes_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE;
ALTER TABLE generated_documents DROP CONSTRAINT IF EXISTS generated_documents_projeto_id_fkey,
  ADD CONSTRAINT generated_documents_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE;
ALTER TABLE layouts_solares DROP CONSTRAINT IF EXISTS layouts_solares_projeto_id_fkey,
  ADD CONSTRAINT layouts_solares_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE;
ALTER TABLE os_instalacao DROP CONSTRAINT IF EXISTS os_instalacao_projeto_id_fkey,
  ADD CONSTRAINT os_instalacao_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE;
ALTER TABLE post_sale_plans DROP CONSTRAINT IF EXISTS post_sale_plans_projeto_id_fkey,
  ADD CONSTRAINT post_sale_plans_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE;
ALTER TABLE post_sale_upsell_opportunities DROP CONSTRAINT IF EXISTS post_sale_upsell_opportunities_projeto_id_fkey,
  ADD CONSTRAINT post_sale_upsell_opportunities_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE;
ALTER TABLE post_sale_visits DROP CONSTRAINT IF EXISTS post_sale_visits_projeto_id_fkey,
  ADD CONSTRAINT post_sale_visits_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE;
ALTER TABLE recebimentos DROP CONSTRAINT IF EXISTS recebimentos_projeto_id_fkey,
  ADD CONSTRAINT recebimentos_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE;
ALTER TABLE servicos_agendados DROP CONSTRAINT IF EXISTS servicos_agendados_projeto_id_fkey,
  ADD CONSTRAINT servicos_agendados_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE;
ALTER TABLE vendas DROP CONSTRAINT IF EXISTS vendas_projeto_id_fkey,
  ADD CONSTRAINT vendas_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE;

-- =============================================
-- FKs referencing PROPOSTA_VERSOES (self-ref)
-- =============================================
ALTER TABLE proposta_versoes DROP CONSTRAINT IF EXISTS proposta_versoes_substituida_por_fkey,
  ADD CONSTRAINT proposta_versoes_substituida_por_fkey FOREIGN KEY (substituida_por) REFERENCES proposta_versoes(id) ON DELETE SET NULL;

-- =============================================
-- FKs referencing RECEBIMENTOS
-- =============================================
ALTER TABLE pagamentos DROP CONSTRAINT IF EXISTS pagamentos_recebimento_id_fkey,
  ADD CONSTRAINT pagamentos_recebimento_id_fkey FOREIGN KEY (recebimento_id) REFERENCES recebimentos(id) ON DELETE CASCADE;
ALTER TABLE parcelas DROP CONSTRAINT IF EXISTS parcelas_recebimento_id_fkey,
  ADD CONSTRAINT parcelas_recebimento_id_fkey FOREIGN KEY (recebimento_id) REFERENCES recebimentos(id) ON DELETE CASCADE;

-- =============================================
-- FKs referencing UNITS_CONSUMIDORAS
-- =============================================
ALTER TABLE gd_group_beneficiaries DROP CONSTRAINT IF EXISTS gd_group_beneficiaries_uc_beneficiaria_id_fkey,
  ADD CONSTRAINT gd_group_beneficiaries_uc_beneficiaria_id_fkey FOREIGN KEY (uc_beneficiaria_id) REFERENCES units_consumidoras(id) ON DELETE CASCADE;
ALTER TABLE gd_groups DROP CONSTRAINT IF EXISTS gd_groups_uc_geradora_id_fkey,
  ADD CONSTRAINT gd_groups_uc_geradora_id_fkey FOREIGN KEY (uc_geradora_id) REFERENCES units_consumidoras(id) ON DELETE CASCADE;

-- =============================================
-- FKs referencing WA_CONVERSATIONS
-- =============================================
ALTER TABLE wa_conversation_participants DROP CONSTRAINT IF EXISTS wa_conversation_participants_conversation_id_fkey,
  ADD CONSTRAINT wa_conversation_participants_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES wa_conversations(id) ON DELETE CASCADE;
ALTER TABLE wa_followup_logs DROP CONSTRAINT IF EXISTS wa_followup_logs_conversation_id_fkey,
  ADD CONSTRAINT wa_followup_logs_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES wa_conversations(id) ON DELETE CASCADE;
ALTER TABLE wa_internal_threads DROP CONSTRAINT IF EXISTS wa_internal_threads_conversation_id_fkey,
  ADD CONSTRAINT wa_internal_threads_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES wa_conversations(id) ON DELETE CASCADE;
ALTER TABLE wa_participant_events DROP CONSTRAINT IF EXISTS wa_participant_events_conversation_id_fkey,
  ADD CONSTRAINT wa_participant_events_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES wa_conversations(id) ON DELETE CASCADE;

-- =============================================
-- FKs referencing PAGAMENTOS (child of recebimentos)
-- =============================================
ALTER TABLE parcelas DROP CONSTRAINT IF EXISTS parcelas_pagamento_id_fkey,
  ADD CONSTRAINT parcelas_pagamento_id_fkey FOREIGN KEY (pagamento_id) REFERENCES pagamentos(id) ON DELETE CASCADE;

-- =============================================
-- SIMPLIFIED FUNCTIONS
-- =============================================
CREATE OR REPLACE FUNCTION public.reset_migrated_data(p_tenant_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- CASCADE handles all children automatically
  DELETE FROM clientes WHERE tenant_id = p_tenant_id;

  -- Reset SM migration flags
  UPDATE solar_market_proposals SET migrado_em = NULL WHERE tenant_id = p_tenant_id;
  UPDATE solar_market_projects SET migrado_em = NULL WHERE tenant_id = p_tenant_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_tenant_data(p_tenant_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.reset_migrated_data(p_tenant_id);

  DELETE FROM solar_market_custom_field_values WHERE tenant_id = p_tenant_id;
  DELETE FROM solar_market_custom_fields WHERE tenant_id = p_tenant_id;
  DELETE FROM solar_market_proposals WHERE tenant_id = p_tenant_id;
  DELETE FROM solar_market_projects WHERE tenant_id = p_tenant_id;
  DELETE FROM solar_market_clients WHERE tenant_id = p_tenant_id;
  DELETE FROM solar_market_funnel_stages WHERE tenant_id = p_tenant_id;
  DELETE FROM solar_market_funnels WHERE tenant_id = p_tenant_id;
  DELETE FROM solar_market_sync_logs WHERE tenant_id = p_tenant_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
