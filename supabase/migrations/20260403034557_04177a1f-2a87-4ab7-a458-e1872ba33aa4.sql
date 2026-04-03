CREATE OR REPLACE FUNCTION public.reset_migrated_data(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM wa_messages WHERE tenant_id = p_tenant_id;
  DELETE FROM wa_reads WHERE tenant_id = p_tenant_id;
  DELETE FROM wa_outbox WHERE tenant_id = p_tenant_id;
  DELETE FROM wa_transfers WHERE tenant_id = p_tenant_id;
  DELETE FROM wa_sla_alerts WHERE tenant_id = p_tenant_id;
  DELETE FROM wa_satisfaction_ratings WHERE tenant_id = p_tenant_id;
  DELETE FROM wa_participant_events WHERE tenant_id = p_tenant_id;
  DELETE FROM wa_internal_threads WHERE tenant_id = p_tenant_id;
  DELETE FROM wa_followup_logs WHERE tenant_id = p_tenant_id;
  DELETE FROM wa_conversation_tags WHERE tenant_id = p_tenant_id;
  DELETE FROM wa_conversation_summaries WHERE tenant_id = p_tenant_id;
  DELETE FROM wa_conversation_preferences WHERE tenant_id = p_tenant_id;
  DELETE FROM wa_conversation_participants WHERE tenant_id = p_tenant_id;
  DELETE FROM wa_auto_reply_log WHERE tenant_id = p_tenant_id;
  DELETE FROM wa_ai_tasks WHERE tenant_id = p_tenant_id;
  DELETE FROM wa_cadence_enrollments WHERE tenant_id = p_tenant_id;
  DELETE FROM push_muted_conversations WHERE tenant_id = p_tenant_id;
  DELETE FROM appointments WHERE tenant_id = p_tenant_id;
  DELETE FROM wa_conversations WHERE tenant_id = p_tenant_id;

  DELETE FROM unit_invoices WHERE tenant_id = p_tenant_id;
  DELETE FROM unit_credits WHERE tenant_id = p_tenant_id;
  DELETE FROM unit_billing_email_settings WHERE tenant_id = p_tenant_id;
  DELETE FROM unit_meter_links WHERE tenant_id = p_tenant_id;
  DELETE FROM unit_plant_links WHERE tenant_id = p_tenant_id;
  DELETE FROM unit_reading_alerts WHERE tenant_id = p_tenant_id;
  DELETE FROM uc_client_tokens WHERE tenant_id = p_tenant_id;
  DELETE FROM invoice_processing_logs WHERE tenant_id = p_tenant_id;
  DELETE FROM invoice_import_job_items WHERE tenant_id = p_tenant_id;
  DELETE FROM gd_monthly_overflows WHERE tenant_id = p_tenant_id;
  DELETE FROM gd_monthly_allocations WHERE tenant_id = p_tenant_id;
  DELETE FROM gd_group_beneficiaries WHERE tenant_id = p_tenant_id;
  DELETE FROM gd_credit_balances WHERE tenant_id = p_tenant_id;
  DELETE FROM energy_alerts WHERE tenant_id = p_tenant_id;
  DELETE FROM client_portal_users WHERE tenant_id = p_tenant_id;
  DELETE FROM recebimentos WHERE tenant_id = p_tenant_id;
  DELETE FROM gd_groups WHERE tenant_id = p_tenant_id;
  DELETE FROM units_consumidoras WHERE tenant_id = p_tenant_id;

  DELETE FROM proposta_campos_distribuidora WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_cenarios WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_comercial WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_envios WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_kits WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_pagamento_opcoes WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_premissas WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_renders WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_resultados_energia WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_series WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_servicos WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_ucs WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_venda WHERE tenant_id = p_tenant_id;
  DELETE FROM os_instalacao WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_versoes WHERE tenant_id = p_tenant_id;

  DELETE FROM proposal_events WHERE tenant_id = p_tenant_id;
  DELETE FROM proposal_followup_queue WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_aceite_tokens WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_historico WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_views WHERE tenant_id = p_tenant_id;

  DELETE FROM projeto_materiais WHERE tenant_id = p_tenant_id;
  DELETE FROM checklists_instalador WHERE tenant_id = p_tenant_id;
  DELETE FROM checklists_cliente WHERE tenant_id = p_tenant_id;
  DELETE FROM comissoes WHERE tenant_id = p_tenant_id;
  DELETE FROM generated_documents WHERE tenant_id = p_tenant_id;
  DELETE FROM lancamentos_financeiros WHERE tenant_id = p_tenant_id;
  DELETE FROM layouts_solares WHERE tenant_id = p_tenant_id;
  DELETE FROM obras WHERE tenant_id = p_tenant_id;
  DELETE FROM post_sale_plans WHERE tenant_id = p_tenant_id;
  DELETE FROM post_sale_upsell_opportunities WHERE tenant_id = p_tenant_id;
  DELETE FROM post_sale_visits WHERE tenant_id = p_tenant_id;
  DELETE FROM pv_contratos WHERE tenant_id = p_tenant_id;
  DELETE FROM pv_ordens_servico WHERE tenant_id = p_tenant_id;
  DELETE FROM servicos_agendados WHERE tenant_id = p_tenant_id;
  DELETE FROM vendas WHERE tenant_id = p_tenant_id;
  DELETE FROM visitas_tecnicas WHERE tenant_id = p_tenant_id;

  DELETE FROM deal_activities WHERE tenant_id = p_tenant_id;
  DELETE FROM deal_custom_field_values WHERE tenant_id = p_tenant_id;
  DELETE FROM deal_kanban_projection WHERE tenant_id = p_tenant_id;
  DELETE FROM deal_notes WHERE tenant_id = p_tenant_id;
  DELETE FROM deal_pipeline_stages WHERE tenant_id = p_tenant_id;
  DELETE FROM deal_stage_history WHERE tenant_id = p_tenant_id;
  DELETE FROM doc_checklist_status WHERE tenant_id = p_tenant_id;
  DELETE FROM pipeline_automation_logs WHERE tenant_id = p_tenant_id;
  DELETE FROM project_events WHERE tenant_id = p_tenant_id;
  DELETE FROM projeto_etiqueta_rel
  WHERE projeto_id IN (
    SELECT id FROM deals WHERE tenant_id = p_tenant_id
  );

  DELETE FROM payment_gateway_charges WHERE tenant_id = p_tenant_id;
  DELETE FROM pagamentos WHERE tenant_id = p_tenant_id;
  DELETE FROM parcelas WHERE tenant_id = p_tenant_id;

  DELETE FROM contacts WHERE tenant_id = p_tenant_id;
  DELETE FROM fiscal_invoices WHERE tenant_id = p_tenant_id;
  DELETE FROM monitor_plants WHERE tenant_id = p_tenant_id;
  DELETE FROM monitor_subscriptions WHERE tenant_id = p_tenant_id;
  DELETE FROM whatsapp_automation_logs WHERE tenant_id = p_tenant_id;

  DELETE FROM propostas_nativas WHERE tenant_id = p_tenant_id;
  DELETE FROM projetos WHERE tenant_id = p_tenant_id;
  DELETE FROM deals WHERE tenant_id = p_tenant_id;
  DELETE FROM clientes WHERE tenant_id = p_tenant_id;

  UPDATE solar_market_proposals
  SET migrado_em = NULL
  WHERE tenant_id = p_tenant_id;

  UPDATE solar_market_projects
  SET migrado_em = NULL
  WHERE tenant_id = p_tenant_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_tenant_data(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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