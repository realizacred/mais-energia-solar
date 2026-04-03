CREATE OR REPLACE FUNCTION reset_migrated_data(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb := '{}';
  v_count int;
BEGIN
  -- Filhas de propostas_nativas
  DELETE FROM proposta_versoes WHERE proposta_id IN (
    SELECT id FROM propostas_nativas WHERE tenant_id = p_tenant_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  result := result || jsonb_build_object('proposta_versoes', v_count);

  DELETE FROM recebimentos WHERE tenant_id = p_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  result := result || jsonb_build_object('recebimentos', v_count);

  -- Filhas de projetos
  DELETE FROM comissoes WHERE tenant_id = p_tenant_id;
  DELETE FROM checklists_instalador WHERE tenant_id = p_tenant_id;
  DELETE FROM checklists_cliente WHERE tenant_id = p_tenant_id;
  DELETE FROM obras WHERE tenant_id = p_tenant_id;
  DELETE FROM os_instalacao WHERE tenant_id = p_tenant_id;
  DELETE FROM visitas_tecnicas WHERE tenant_id = p_tenant_id;
  DELETE FROM vendas WHERE tenant_id = p_tenant_id;
  DELETE FROM layouts_solares WHERE tenant_id = p_tenant_id;
  DELETE FROM generated_documents WHERE tenant_id = p_tenant_id;
  DELETE FROM pv_contratos WHERE tenant_id = p_tenant_id;
  DELETE FROM pv_ordens_servico WHERE tenant_id = p_tenant_id;

  -- Filhas de deals
  DELETE FROM deal_activities WHERE tenant_id = p_tenant_id;
  DELETE FROM deal_notes WHERE tenant_id = p_tenant_id;
  DELETE FROM deal_pipeline_stages WHERE tenant_id = p_tenant_id;
  DELETE FROM deal_stage_history WHERE tenant_id = p_tenant_id;
  DELETE FROM deal_custom_field_values WHERE tenant_id = p_tenant_id;
  DELETE FROM deal_kanban_projection WHERE tenant_id = p_tenant_id;
  DELETE FROM doc_checklist_status WHERE tenant_id = p_tenant_id;
  DELETE FROM pipeline_automation_logs WHERE tenant_id = p_tenant_id;
  DELETE FROM project_events WHERE tenant_id = p_tenant_id;

  -- Filhas de clientes
  DELETE FROM pagamentos WHERE tenant_id = p_tenant_id;
  DELETE FROM parcelas WHERE tenant_id = p_tenant_id;
  DELETE FROM lancamentos_financeiros WHERE tenant_id = p_tenant_id;
  DELETE FROM units_consumidoras WHERE tenant_id = p_tenant_id;
  DELETE FROM wa_cadence_enrollments WHERE tenant_id = p_tenant_id;
  DELETE FROM wa_conversations WHERE tenant_id = p_tenant_id;
  DELETE FROM whatsapp_automation_logs WHERE tenant_id = p_tenant_id;
  DELETE FROM appointments WHERE tenant_id = p_tenant_id;
  DELETE FROM servicos_agendados WHERE tenant_id = p_tenant_id;
  DELETE FROM post_sale_plans WHERE tenant_id = p_tenant_id;
  DELETE FROM post_sale_visits WHERE tenant_id = p_tenant_id;
  DELETE FROM post_sale_upsell_opportunities WHERE tenant_id = p_tenant_id;
  DELETE FROM monitor_plants WHERE tenant_id = p_tenant_id;
  DELETE FROM monitor_subscriptions WHERE tenant_id = p_tenant_id;
  DELETE FROM fiscal_invoices WHERE tenant_id = p_tenant_id;
  DELETE FROM gd_groups WHERE tenant_id = p_tenant_id;
  DELETE FROM contacts WHERE tenant_id = p_tenant_id;

  -- Tabelas principais
  DELETE FROM propostas_nativas WHERE tenant_id = p_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  result := result || jsonb_build_object('propostas_nativas', v_count);

  DELETE FROM projetos WHERE tenant_id = p_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  result := result || jsonb_build_object('projetos', v_count);

  DELETE FROM deals WHERE tenant_id = p_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  result := result || jsonb_build_object('deals', v_count);

  DELETE FROM clientes WHERE tenant_id = p_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  result := result || jsonb_build_object('clientes', v_count);

  -- Resetar flags SM
  UPDATE solar_market_proposals SET migrado_em = NULL WHERE tenant_id = p_tenant_id;
  UPDATE solar_market_projects SET migrado_em = NULL WHERE tenant_id = p_tenant_id;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION reset_tenant_data(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb := '{}';
  v_count int;
BEGIN
  -- Filhas de propostas_nativas
  DELETE FROM proposta_versoes WHERE proposta_id IN (
    SELECT id FROM propostas_nativas WHERE tenant_id = p_tenant_id);
  DELETE FROM recebimentos WHERE tenant_id = p_tenant_id;

  -- Filhas de projetos
  DELETE FROM comissoes WHERE tenant_id = p_tenant_id;
  DELETE FROM checklists_instalador WHERE tenant_id = p_tenant_id;
  DELETE FROM checklists_cliente WHERE tenant_id = p_tenant_id;
  DELETE FROM obras WHERE tenant_id = p_tenant_id;
  DELETE FROM os_instalacao WHERE tenant_id = p_tenant_id;
  DELETE FROM visitas_tecnicas WHERE tenant_id = p_tenant_id;
  DELETE FROM vendas WHERE tenant_id = p_tenant_id;
  DELETE FROM layouts_solares WHERE tenant_id = p_tenant_id;
  DELETE FROM generated_documents WHERE tenant_id = p_tenant_id;
  DELETE FROM pv_contratos WHERE tenant_id = p_tenant_id;
  DELETE FROM pv_ordens_servico WHERE tenant_id = p_tenant_id;

  -- Filhas de deals
  DELETE FROM deal_activities WHERE tenant_id = p_tenant_id;
  DELETE FROM deal_notes WHERE tenant_id = p_tenant_id;
  DELETE FROM deal_pipeline_stages WHERE tenant_id = p_tenant_id;
  DELETE FROM deal_stage_history WHERE tenant_id = p_tenant_id;
  DELETE FROM deal_custom_field_values WHERE tenant_id = p_tenant_id;
  DELETE FROM deal_kanban_projection WHERE tenant_id = p_tenant_id;
  DELETE FROM doc_checklist_status WHERE tenant_id = p_tenant_id;
  DELETE FROM pipeline_automation_logs WHERE tenant_id = p_tenant_id;
  DELETE FROM project_events WHERE tenant_id = p_tenant_id;

  -- Filhas de clientes
  DELETE FROM pagamentos WHERE tenant_id = p_tenant_id;
  DELETE FROM parcelas WHERE tenant_id = p_tenant_id;
  DELETE FROM lancamentos_financeiros WHERE tenant_id = p_tenant_id;
  DELETE FROM units_consumidoras WHERE tenant_id = p_tenant_id;
  DELETE FROM wa_cadence_enrollments WHERE tenant_id = p_tenant_id;
  DELETE FROM wa_conversations WHERE tenant_id = p_tenant_id;
  DELETE FROM whatsapp_automation_logs WHERE tenant_id = p_tenant_id;
  DELETE FROM appointments WHERE tenant_id = p_tenant_id;
  DELETE FROM servicos_agendados WHERE tenant_id = p_tenant_id;
  DELETE FROM post_sale_plans WHERE tenant_id = p_tenant_id;
  DELETE FROM post_sale_visits WHERE tenant_id = p_tenant_id;
  DELETE FROM post_sale_upsell_opportunities WHERE tenant_id = p_tenant_id;
  DELETE FROM monitor_plants WHERE tenant_id = p_tenant_id;
  DELETE FROM monitor_subscriptions WHERE tenant_id = p_tenant_id;
  DELETE FROM fiscal_invoices WHERE tenant_id = p_tenant_id;
  DELETE FROM gd_groups WHERE tenant_id = p_tenant_id;
  DELETE FROM contacts WHERE tenant_id = p_tenant_id;

  -- Tabelas principais
  DELETE FROM propostas_nativas WHERE tenant_id = p_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  result := result || jsonb_build_object('propostas_nativas', v_count);

  DELETE FROM projetos WHERE tenant_id = p_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  result := result || jsonb_build_object('projetos', v_count);

  DELETE FROM deals WHERE tenant_id = p_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  result := result || jsonb_build_object('deals', v_count);

  DELETE FROM clientes WHERE tenant_id = p_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  result := result || jsonb_build_object('clientes', v_count);

  -- Tabelas SM
  DELETE FROM solar_market_custom_field_values WHERE tenant_id = p_tenant_id;
  DELETE FROM solar_market_custom_fields WHERE tenant_id = p_tenant_id;
  DELETE FROM solar_market_proposals WHERE tenant_id = p_tenant_id;
  DELETE FROM solar_market_projects WHERE tenant_id = p_tenant_id;
  DELETE FROM solar_market_clients WHERE tenant_id = p_tenant_id;
  DELETE FROM solar_market_funnel_stages WHERE tenant_id = p_tenant_id;
  DELETE FROM solar_market_funnels WHERE tenant_id = p_tenant_id;
  DELETE FROM solar_market_sync_logs WHERE tenant_id = p_tenant_id;

  RETURN result;
END;
$$;