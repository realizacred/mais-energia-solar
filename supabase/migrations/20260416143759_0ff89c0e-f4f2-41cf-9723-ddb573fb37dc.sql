
-- =============================================================================
-- FIX: reset_project_area — ordem auditada de exclusão com todas as FKs reais
-- =============================================================================
CREATE OR REPLACE FUNCTION public.reset_project_area(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '120s'
AS $$
DECLARE
  v_clientes     int := 0;
  v_projetos     int := 0;
  v_deals        int := 0;
  v_propostas    int := 0;
  v_versoes      int := 0;
  v_documentos   int := 0;
  v_recebimentos int := 0;
  v_comissoes    int := 0;
  v_checklists   int := 0;
  v_appointments int := 0;
BEGIN
  -- =============================================
  -- FASE 0: Quebrar referências circulares e NO ACTION FKs
  -- =============================================
  UPDATE projetos SET funil_id = NULL, etapa_id = NULL, deal_id = NULL, proposta_id = NULL
  WHERE tenant_id = p_tenant_id;

  UPDATE deals SET projeto_id = NULL
  WHERE tenant_id = p_tenant_id;

  UPDATE proposta_versoes SET substituida_por = NULL
  WHERE tenant_id = p_tenant_id;

  -- =============================================
  -- FASE 1: Filhos de proposta_aceite_tokens (NO ACTION FKs)
  -- =============================================
  DELETE FROM proposta_views WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_envios WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_aceite_tokens WHERE tenant_id = p_tenant_id;

  -- =============================================
  -- FASE 2: Filhos de proposta_versoes
  -- =============================================
  DELETE FROM proposta_versao_series WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_cenarios WHERE versao_id IN (
    SELECT pv.id FROM proposta_versoes pv
    JOIN propostas_nativas pn ON pn.id = pv.proposta_id
    WHERE pn.tenant_id = p_tenant_id
  );
  DELETE FROM proposta_campos_distribuidora WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_comercial WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_kits WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_pagamento_opcoes WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_premissas WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_renders WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_resultados_energia WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_series WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_servicos WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_ucs WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_venda WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_versao_servicos WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_versao_ucs WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_versao_variaveis WHERE tenant_id = p_tenant_id;

  -- proposta_versoes
  WITH del AS (
    DELETE FROM proposta_versoes
    WHERE proposta_id IN (SELECT id FROM propostas_nativas WHERE tenant_id = p_tenant_id)
    RETURNING 1
  ) SELECT count(*) INTO v_versoes FROM del;

  -- =============================================
  -- FASE 3: Filhos de propostas_nativas
  -- =============================================
  DELETE FROM proposal_events WHERE tenant_id = p_tenant_id;
  DELETE FROM proposal_followup_queue WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_historico WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_grupo_tokens WHERE tenant_id = p_tenant_id;

  -- propostas_nativas
  WITH del AS (
    DELETE FROM propostas_nativas WHERE tenant_id = p_tenant_id RETURNING 1
  ) SELECT count(*) INTO v_propostas FROM del;

  -- =============================================
  -- FASE 4: generated_documents, comissoes, recebimentos
  -- =============================================
  WITH del AS (
    DELETE FROM generated_documents WHERE tenant_id = p_tenant_id RETURNING 1
  ) SELECT count(*) INTO v_documentos FROM del;

  WITH del AS (
    DELETE FROM comissoes WHERE tenant_id = p_tenant_id RETURNING 1
  ) SELECT count(*) INTO v_comissoes FROM del;

  WITH del AS (
    DELETE FROM recebimentos WHERE tenant_id = p_tenant_id RETURNING 1
  ) SELECT count(*) INTO v_recebimentos FROM del;

  -- =============================================
  -- FASE 5: Checklists (arquivos → respostas → checklists)
  -- =============================================
  DELETE FROM checklist_cliente_arquivos WHERE tenant_id = p_tenant_id;
  DELETE FROM checklist_cliente_respostas WHERE tenant_id = p_tenant_id;
  DELETE FROM checklists_cliente WHERE tenant_id = p_tenant_id;
  DELETE FROM checklist_instalador_arquivos WHERE tenant_id = p_tenant_id;
  DELETE FROM checklist_instalador_respostas WHERE tenant_id = p_tenant_id;
  WITH del AS (
    DELETE FROM checklists_instalador WHERE tenant_id = p_tenant_id RETURNING 1
  ) SELECT count(*) INTO v_checklists FROM del;
  DELETE FROM checklists_instalacao WHERE tenant_id = p_tenant_id;

  -- =============================================
  -- FASE 6: Filhos de deals
  -- =============================================
  DELETE FROM deal_custom_field_values WHERE deal_id IN (SELECT id FROM deals WHERE tenant_id = p_tenant_id);
  DELETE FROM deal_activities WHERE deal_id IN (SELECT id FROM deals WHERE tenant_id = p_tenant_id);
  DELETE FROM deal_notes WHERE deal_id IN (SELECT id FROM deals WHERE tenant_id = p_tenant_id);
  DELETE FROM deal_stage_history WHERE deal_id IN (SELECT id FROM deals WHERE tenant_id = p_tenant_id);
  DELETE FROM deal_pipeline_stages WHERE tenant_id = p_tenant_id;
  DELETE FROM deal_kanban_projection WHERE tenant_id = p_tenant_id;
  DELETE FROM doc_checklist_status WHERE tenant_id = p_tenant_id;
  DELETE FROM pipeline_automation_logs WHERE tenant_id = p_tenant_id;
  DELETE FROM project_events WHERE tenant_id = p_tenant_id;
  DELETE FROM projeto_etiqueta_rel WHERE projeto_id IN (SELECT id FROM deals WHERE tenant_id = p_tenant_id);

  -- =============================================
  -- FASE 7: Filhos de projetos
  -- =============================================
  DELETE FROM ordens_compra WHERE tenant_id = p_tenant_id;
  DELETE FROM projeto_ativacao WHERE tenant_id = p_tenant_id;
  DELETE FROM projeto_materiais WHERE tenant_id = p_tenant_id;
  DELETE FROM projeto_medidor WHERE tenant_id = p_tenant_id;
  DELETE FROM projeto_vistoria WHERE tenant_id = p_tenant_id;
  DELETE FROM post_sale_visits WHERE tenant_id = p_tenant_id;
  DELETE FROM post_sale_upsell_opportunities WHERE tenant_id = p_tenant_id;
  DELETE FROM post_sale_plans WHERE tenant_id = p_tenant_id;
  DELETE FROM vendas WHERE tenant_id = p_tenant_id;
  DELETE FROM servicos_agendados WHERE tenant_id = p_tenant_id;
  DELETE FROM layouts_solares WHERE tenant_id = p_tenant_id;
  DELETE FROM obras WHERE tenant_id = p_tenant_id;
  DELETE FROM os_instalacao WHERE tenant_id = p_tenant_id;
  DELETE FROM lancamentos_financeiros WHERE tenant_id = p_tenant_id;

  -- =============================================
  -- FASE 8: Appointments
  -- =============================================
  DELETE FROM appointment_reagendamentos WHERE tenant_id = p_tenant_id;
  DELETE FROM calendar_sync_queue WHERE tenant_id = p_tenant_id;
  WITH del AS (
    DELETE FROM appointments WHERE tenant_id = p_tenant_id RETURNING 1
  ) SELECT count(*) INTO v_appointments FROM del;

  -- =============================================
  -- FASE 9: projeto_funis (agora seguro — funil_id/etapa_id já NULLificados)
  -- =============================================
  DELETE FROM projeto_etapas WHERE tenant_id = p_tenant_id;
  DELETE FROM projeto_funis WHERE tenant_id = p_tenant_id;

  -- =============================================
  -- FASE 10: projetos → deals → clientes
  -- =============================================
  WITH del AS (
    DELETE FROM projetos WHERE tenant_id = p_tenant_id RETURNING 1
  ) SELECT count(*) INTO v_projetos FROM del;

  WITH del AS (
    DELETE FROM deals WHERE tenant_id = p_tenant_id RETURNING 1
  ) SELECT count(*) INTO v_deals FROM del;

  -- Nullificar refs NO ACTION em tabelas que NÃO são do escopo projeto
  UPDATE gd_groups SET cliente_id = NULL WHERE cliente_id IN (SELECT id FROM clientes WHERE tenant_id = p_tenant_id);
  UPDATE monitor_plants SET client_id = NULL WHERE client_id IN (SELECT id FROM clientes WHERE tenant_id = p_tenant_id);
  UPDATE units_consumidoras SET cliente_id = NULL WHERE cliente_id IN (SELECT id FROM clientes WHERE tenant_id = p_tenant_id);
  UPDATE wa_cadence_enrollments SET cliente_id = NULL WHERE cliente_id IN (SELECT id FROM clientes WHERE tenant_id = p_tenant_id);
  UPDATE wa_conversations SET cliente_id = NULL WHERE cliente_id IN (SELECT id FROM clientes WHERE tenant_id = p_tenant_id);

  WITH del AS (
    DELETE FROM clientes WHERE tenant_id = p_tenant_id RETURNING 1
  ) SELECT count(*) INTO v_clientes FROM del;

  -- =============================================
  -- FASE 11: Reset sequences e flags SM
  -- =============================================
  PERFORM setval('public.cliente_code_seq', 1, false);
  PERFORM setval('public.projeto_code_seq', 1, false);
  PERFORM setval('public.projeto_num_seq', 1, false);
  PERFORM setval('public.proposta_code_seq', 1, false);
  PERFORM setval('public.proposta_num_seq', 1, false);

  UPDATE solar_market_proposals SET migrado_em = NULL WHERE tenant_id = p_tenant_id;
  UPDATE solar_market_projects SET migrado_em = NULL WHERE tenant_id = p_tenant_id;

  RETURN jsonb_build_object(
    'success', true,
    'clientes', v_clientes,
    'projetos', v_projetos,
    'deals', v_deals,
    'propostas', v_propostas,
    'versoes', v_versoes,
    'documentos', v_documentos,
    'recebimentos', v_recebimentos,
    'comissoes', v_comissoes,
    'checklists', v_checklists,
    'appointments', v_appointments
  );
END;
$$;

-- =============================================================================
-- FIX: reset_migrated_data — adiciona filhos faltantes para dados SM
-- =============================================================================
CREATE OR REPLACE FUNCTION public.reset_migrated_data(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '120s'
AS $$
DECLARE
  v_propostas int := 0;
  v_versoes   int := 0;
  v_projetos  int := 0;
  v_deals     int := 0;
  v_clientes  int := 0;
  v_blocking_op text;
BEGIN
  -- =========================================================
  -- GUARD 1: bloquear operações conflitantes via SSOT
  -- =========================================================
  SELECT operation_type INTO v_blocking_op
  FROM sm_operation_runs
  WHERE tenant_id = p_tenant_id
    AND status IN ('queued', 'running')
    AND operation_type IN ('migrate_to_native', 'reset_migrated', 'reset_staging')
    AND (heartbeat_at IS NULL OR heartbeat_at > NOW() - INTERVAL '15 minutes'
         OR started_at > NOW() - INTERVAL '15 minutes')
  ORDER BY created_at DESC LIMIT 1;

  IF v_blocking_op IS NOT NULL THEN
    RETURN jsonb_build_object('success', false,
      'error', format('Reset bloqueado: operação "%s" em andamento.', v_blocking_op));
  END IF;

  -- =========================================================
  -- GUARD 2: Legacy fallback
  -- =========================================================
  IF EXISTS (
    SELECT 1 FROM solar_market_sync_logs
    WHERE tenant_id = p_tenant_id AND status = 'running'
      AND started_at > NOW() - INTERVAL '15 minutes'
  ) THEN
    RETURN jsonb_build_object('success', false,
      'error', 'Reset bloqueado: sincronização em andamento.');
  END IF;

  UPDATE solar_market_sync_logs
  SET status = 'failed', finished_at = NOW()
  WHERE tenant_id = p_tenant_id AND status = 'running'
    AND started_at <= NOW() - INTERVAL '15 minutes';

  -- =========================================================
  -- Quebrar referências circulares nos registros SM
  -- =========================================================
  UPDATE projetos SET funil_id = NULL, etapa_id = NULL, deal_id = NULL, proposta_id = NULL
  WHERE tenant_id = p_tenant_id AND import_source = 'solar_market';

  UPDATE deals SET projeto_id = NULL
  WHERE tenant_id = p_tenant_id AND import_source = 'solar_market';

  UPDATE proposta_versoes SET substituida_por = NULL
  WHERE proposta_id IN (
    SELECT id FROM propostas_nativas WHERE tenant_id = p_tenant_id AND import_source = 'solar_market'
  );

  -- =========================================================
  -- Filhos de proposta_versoes (SM)
  -- =========================================================
  DELETE FROM proposta_views WHERE tenant_id = p_tenant_id
    AND proposta_id IN (SELECT id FROM propostas_nativas WHERE tenant_id = p_tenant_id AND import_source = 'solar_market');

  DELETE FROM proposta_envios WHERE tenant_id = p_tenant_id
    AND versao_id IN (
      SELECT pv.id FROM proposta_versoes pv
      JOIN propostas_nativas pn ON pn.id = pv.proposta_id
      WHERE pn.tenant_id = p_tenant_id AND pn.import_source = 'solar_market'
    );

  DELETE FROM proposta_aceite_tokens WHERE tenant_id = p_tenant_id
    AND proposta_id IN (SELECT id FROM propostas_nativas WHERE tenant_id = p_tenant_id AND import_source = 'solar_market');

  DELETE FROM proposta_cenarios WHERE versao_id IN (
    SELECT pv.id FROM proposta_versoes pv
    JOIN propostas_nativas pn ON pn.id = pv.proposta_id
    WHERE pn.tenant_id = p_tenant_id AND pn.import_source = 'solar_market'
  );

  -- proposta_versoes
  DELETE FROM proposta_versoes WHERE proposta_id IN (
    SELECT id FROM propostas_nativas WHERE tenant_id = p_tenant_id AND import_source = 'solar_market'
  );
  GET DIAGNOSTICS v_versoes = ROW_COUNT;

  -- Filhos de propostas_nativas
  DELETE FROM proposal_events WHERE tenant_id = p_tenant_id
    AND proposta_id IN (SELECT id FROM propostas_nativas WHERE tenant_id = p_tenant_id AND import_source = 'solar_market');
  DELETE FROM proposal_followup_queue WHERE tenant_id = p_tenant_id
    AND proposta_id IN (SELECT id FROM propostas_nativas WHERE tenant_id = p_tenant_id AND import_source = 'solar_market');
  DELETE FROM proposta_historico WHERE tenant_id = p_tenant_id
    AND proposta_id IN (SELECT id FROM propostas_nativas WHERE tenant_id = p_tenant_id AND import_source = 'solar_market');
  DELETE FROM proposta_grupo_tokens WHERE tenant_id = p_tenant_id
    AND kit_aceito_id IN (SELECT id FROM propostas_nativas WHERE tenant_id = p_tenant_id AND import_source = 'solar_market');

  DELETE FROM propostas_nativas WHERE tenant_id = p_tenant_id AND import_source = 'solar_market';
  GET DIAGNOSTICS v_propostas = ROW_COUNT;

  -- =========================================================
  -- Filhos de deals SM
  -- =========================================================
  DELETE FROM deal_custom_field_values WHERE deal_id IN (SELECT id FROM deals WHERE tenant_id = p_tenant_id AND import_source = 'solar_market');
  DELETE FROM deal_activities WHERE deal_id IN (SELECT id FROM deals WHERE tenant_id = p_tenant_id AND import_source = 'solar_market');
  DELETE FROM deal_notes WHERE deal_id IN (SELECT id FROM deals WHERE tenant_id = p_tenant_id AND import_source = 'solar_market');
  DELETE FROM deal_stage_history WHERE deal_id IN (SELECT id FROM deals WHERE tenant_id = p_tenant_id AND import_source = 'solar_market');
  DELETE FROM deal_pipeline_stages WHERE deal_id IN (SELECT id FROM deals WHERE tenant_id = p_tenant_id AND import_source = 'solar_market');
  DELETE FROM deal_kanban_projection WHERE deal_id IN (SELECT id FROM deals WHERE tenant_id = p_tenant_id AND import_source = 'solar_market');
  DELETE FROM pipeline_automation_logs WHERE deal_id IN (SELECT id FROM deals WHERE tenant_id = p_tenant_id AND import_source = 'solar_market');
  DELETE FROM project_events WHERE deal_id IN (SELECT id FROM deals WHERE tenant_id = p_tenant_id AND import_source = 'solar_market');
  DELETE FROM projeto_etiqueta_rel WHERE projeto_id IN (SELECT id FROM deals WHERE tenant_id = p_tenant_id AND import_source = 'solar_market');

  -- deals SM
  DELETE FROM deals WHERE tenant_id = p_tenant_id AND import_source = 'solar_market';
  GET DIAGNOSTICS v_deals = ROW_COUNT;

  -- =========================================================
  -- Filhos de projetos SM
  -- =========================================================
  DELETE FROM generated_documents WHERE projeto_id IN (SELECT id FROM projetos WHERE tenant_id = p_tenant_id AND import_source = 'solar_market');
  DELETE FROM ordens_compra WHERE projeto_id IN (SELECT id FROM projetos WHERE tenant_id = p_tenant_id AND import_source = 'solar_market');
  DELETE FROM projeto_ativacao WHERE projeto_id IN (SELECT id FROM projetos WHERE tenant_id = p_tenant_id AND import_source = 'solar_market');

  DELETE FROM projetos WHERE tenant_id = p_tenant_id AND import_source = 'solar_market';
  GET DIAGNOSTICS v_projetos = ROW_COUNT;

  -- clientes SM (sem vínculo nativo)
  DELETE FROM clientes WHERE tenant_id = p_tenant_id AND import_source = 'solar_market'
    AND NOT EXISTS (SELECT 1 FROM projetos p WHERE p.cliente_id = clientes.id AND COALESCE(p.import_source,'') <> 'solar_market');
  GET DIAGNOSTICS v_clientes = ROW_COUNT;

  -- =========================================================
  -- Reseta flags para re-migração
  -- =========================================================
  UPDATE solar_market_proposals SET migrado_em = NULL WHERE tenant_id = p_tenant_id;
  UPDATE solar_market_projects SET migrado_em = NULL WHERE tenant_id = p_tenant_id;

  RETURN jsonb_build_object(
    'success', true,
    'propostas_nativas', v_propostas,
    'proposta_versoes', v_versoes,
    'projetos', v_projetos,
    'deals', v_deals,
    'clientes', v_clientes
  );
END;
$$;
