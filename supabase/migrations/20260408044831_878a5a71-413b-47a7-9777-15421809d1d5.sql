
CREATE OR REPLACE FUNCTION public.reset_project_area(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_clientes int := 0;
  v_projetos int := 0;
  v_deals int := 0;
  v_propostas int := 0;
  v_versoes int := 0;
  v_documentos int := 0;
  v_recebimentos int := 0;
  v_comissoes int := 0;
  v_checklists int := 0;
  v_appointments int := 0;
BEGIN
  -- 1. proposta_grupo_tokens
  DELETE FROM proposta_grupo_tokens WHERE tenant_id = p_tenant_id;

  -- 2. proposta_aceite_tokens (column is versao_id, not proposta_versao_id)
  DELETE FROM proposta_aceite_tokens WHERE tenant_id = p_tenant_id;

  -- 3. proposta_cenarios
  DELETE FROM proposta_cenarios WHERE versao_id IN (
    SELECT pv.id FROM proposta_versoes pv
    JOIN propostas_nativas pn ON pn.id = pv.proposta_id
    WHERE pn.tenant_id = p_tenant_id
  );

  -- 4. generated_documents
  DELETE FROM generated_documents WHERE tenant_id = p_tenant_id;
  GET DIAGNOSTICS v_documentos = ROW_COUNT;

  -- 5. proposal_events
  DELETE FROM proposal_events WHERE tenant_id = p_tenant_id;

  -- 6. proposta_versoes
  DELETE FROM proposta_versoes WHERE proposta_id IN (
    SELECT id FROM propostas_nativas WHERE tenant_id = p_tenant_id
  );
  GET DIAGNOSTICS v_versoes = ROW_COUNT;

  -- 7. propostas_nativas
  DELETE FROM propostas_nativas WHERE tenant_id = p_tenant_id;
  GET DIAGNOSTICS v_propostas = ROW_COUNT;

  -- 8-10. checklists_cliente
  DELETE FROM checklist_cliente_arquivos WHERE tenant_id = p_tenant_id;
  DELETE FROM checklist_cliente_respostas WHERE tenant_id = p_tenant_id;
  DELETE FROM checklists_cliente WHERE tenant_id = p_tenant_id;

  -- 11-13. checklists_instalador
  DELETE FROM checklist_instalador_arquivos WHERE tenant_id = p_tenant_id;
  DELETE FROM checklist_instalador_respostas WHERE tenant_id = p_tenant_id;
  DELETE FROM checklists_instalador WHERE tenant_id = p_tenant_id;
  GET DIAGNOSTICS v_checklists = ROW_COUNT;

  -- 14. checklists_instalacao
  DELETE FROM checklists_instalacao WHERE tenant_id = p_tenant_id;

  -- 15. comissoes
  DELETE FROM comissoes WHERE tenant_id = p_tenant_id;
  GET DIAGNOSTICS v_comissoes = ROW_COUNT;

  -- 16. recebimentos
  DELETE FROM recebimentos WHERE tenant_id = p_tenant_id;
  GET DIAGNOSTICS v_recebimentos = ROW_COUNT;

  -- 17. deal children
  DELETE FROM deal_custom_field_values WHERE deal_id IN (
    SELECT id FROM deals WHERE tenant_id = p_tenant_id
  );
  DELETE FROM deal_activities WHERE deal_id IN (
    SELECT id FROM deals WHERE tenant_id = p_tenant_id
  );
  DELETE FROM deal_notes WHERE deal_id IN (
    SELECT id FROM deals WHERE tenant_id = p_tenant_id
  );
  DELETE FROM deal_stage_history WHERE deal_id IN (
    SELECT id FROM deals WHERE tenant_id = p_tenant_id
  );

  -- 18. doc_checklist
  DELETE FROM doc_checklist_status WHERE tenant_id = p_tenant_id;
  DELETE FROM doc_checklist_items WHERE tenant_id = p_tenant_id;

  -- 19-20. calendar + appointments
  DELETE FROM calendar_sync_queue WHERE tenant_id = p_tenant_id;
  DELETE FROM appointments WHERE tenant_id = p_tenant_id AND (cliente_id IS NOT NULL OR lead_id IS NULL);
  GET DIAGNOSTICS v_appointments = ROW_COUNT;

  -- 21. servicos_agendados
  DELETE FROM servicos_agendados WHERE tenant_id = p_tenant_id;

  -- 22-24. layouts, obras, os
  DELETE FROM layouts_solares WHERE tenant_id = p_tenant_id;
  DELETE FROM obras WHERE tenant_id = p_tenant_id;
  DELETE FROM os_instalacao WHERE tenant_id = p_tenant_id;

  -- 25. projetos
  DELETE FROM projetos WHERE tenant_id = p_tenant_id;
  GET DIAGNOSTICS v_projetos = ROW_COUNT;

  -- 26. deals
  DELETE FROM deals WHERE tenant_id = p_tenant_id;
  GET DIAGNOSTICS v_deals = ROW_COUNT;

  -- 27. clientes
  DELETE FROM clientes WHERE tenant_id = p_tenant_id;
  GET DIAGNOSTICS v_clientes = ROW_COUNT;

  -- 28. Reset sequences
  PERFORM setval('public.cliente_code_seq', 1, false);
  PERFORM setval('public.projeto_code_seq', 1, false);
  PERFORM setval('public.projeto_num_seq', 1, false);
  PERFORM setval('public.proposta_code_seq', 1, false);
  PERFORM setval('public.proposta_num_seq', 1, false);

  -- 29. Reset SM migration flags
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
