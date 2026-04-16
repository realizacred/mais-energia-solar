
CREATE OR REPLACE FUNCTION public.reset_project_area(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '120s'
AS $$
DECLARE
  v_clientes   int := 0;
  v_projetos   int := 0;
  v_deals      int := 0;
  v_propostas  int := 0;
  v_versoes    int := 0;
  v_documentos int := 0;
  v_recebimentos int := 0;
  v_comissoes  int := 0;
  v_checklists int := 0;
  v_appointments int := 0;
BEGIN
  -- 1. proposta_views
  DELETE FROM proposta_views WHERE tenant_id = p_tenant_id;

  -- 2. proposta_envios
  DELETE FROM proposta_envios WHERE tenant_id = p_tenant_id;

  -- 3. proposta_aceite_tokens
  DELETE FROM proposta_aceite_tokens WHERE tenant_id = p_tenant_id;

  -- 4. proposta_cenarios
  DELETE FROM proposta_cenarios
  WHERE versao_id IN (
    SELECT pv.id FROM proposta_versoes pv
    JOIN propostas_nativas pn ON pn.id = pv.proposta_id
    WHERE pn.tenant_id = p_tenant_id
  );

  -- 5. proposta_versoes
  WITH del AS (
    DELETE FROM proposta_versoes
    WHERE proposta_id IN (SELECT id FROM propostas_nativas WHERE tenant_id = p_tenant_id)
    RETURNING 1
  ) SELECT count(*) INTO v_versoes FROM del;

  -- 6. propostas_nativas
  WITH del AS (
    DELETE FROM propostas_nativas WHERE tenant_id = p_tenant_id RETURNING 1
  ) SELECT count(*) INTO v_propostas FROM del;

  -- 7. generated_documents
  WITH del AS (
    DELETE FROM generated_documents WHERE tenant_id = p_tenant_id RETURNING 1
  ) SELECT count(*) INTO v_documentos FROM del;

  -- 8. comissoes
  WITH del AS (
    DELETE FROM comissoes WHERE tenant_id = p_tenant_id RETURNING 1
  ) SELECT count(*) INTO v_comissoes FROM del;

  -- 9. recebimentos
  WITH del AS (
    DELETE FROM recebimentos WHERE tenant_id = p_tenant_id RETURNING 1
  ) SELECT count(*) INTO v_recebimentos FROM del;

  -- 10. checklist files and responses
  DELETE FROM checklist_cliente_arquivos WHERE tenant_id = p_tenant_id;
  DELETE FROM checklist_cliente_respostas WHERE tenant_id = p_tenant_id;
  DELETE FROM checklist_instalador_arquivos WHERE tenant_id = p_tenant_id;
  DELETE FROM checklist_instalador_respostas WHERE tenant_id = p_tenant_id;

  -- 11. checklists
  DELETE FROM checklists_cliente WHERE tenant_id = p_tenant_id;
  WITH del AS (
    DELETE FROM checklists_instalador WHERE tenant_id = p_tenant_id RETURNING 1
  ) SELECT count(*) INTO v_checklists FROM del;

  -- 12. deal activities, notes, pipeline stages
  DELETE FROM deal_activities WHERE tenant_id = p_tenant_id;
  DELETE FROM deal_notes WHERE tenant_id = p_tenant_id;
  DELETE FROM deal_pipeline_stages WHERE tenant_id = p_tenant_id;

  -- 13. projeto_funis
  DELETE FROM projeto_funis WHERE tenant_id = p_tenant_id;

  -- 14. deal_kanban_projection
  DELETE FROM deal_kanban_projection WHERE tenant_id = p_tenant_id;

  -- 15. appointments
  DELETE FROM appointment_reagendamentos WHERE tenant_id = p_tenant_id;
  WITH del AS (
    DELETE FROM appointments WHERE tenant_id = p_tenant_id RETURNING 1
  ) SELECT count(*) INTO v_appointments FROM del;

  -- 16. servicos_agendados, layouts_solares, obras, os_instalacao
  DELETE FROM servicos_agendados WHERE tenant_id = p_tenant_id;
  DELETE FROM layouts_solares WHERE tenant_id = p_tenant_id;
  DELETE FROM obras WHERE tenant_id = p_tenant_id;
  DELETE FROM os_instalacao WHERE tenant_id = p_tenant_id;

  -- 17. projetos
  WITH del AS (
    DELETE FROM projetos WHERE tenant_id = p_tenant_id RETURNING 1
  ) SELECT count(*) INTO v_projetos FROM del;

  -- 18. deals
  WITH del AS (
    DELETE FROM deals WHERE tenant_id = p_tenant_id RETURNING 1
  ) SELECT count(*) INTO v_deals FROM del;

  -- 19. clientes
  WITH del AS (
    DELETE FROM clientes WHERE tenant_id = p_tenant_id RETURNING 1
  ) SELECT count(*) INTO v_clientes FROM del;

  -- 20. reset sequences
  UPDATE tenants SET
    cliente_code_seq = 0,
    projeto_num_seq = 0,
    proposta_num_seq = 0
  WHERE id = p_tenant_id;

  -- 21. reset SM migration flags
  UPDATE solar_market_projects SET migrado = false, migrado_em = NULL WHERE tenant_id = p_tenant_id;
  UPDATE solar_market_proposals SET migrado = false, migrado_em = NULL WHERE tenant_id = p_tenant_id;
  UPDATE solar_market_clients SET migrado = false, migrado_em = NULL WHERE tenant_id = p_tenant_id;

  RETURN jsonb_build_object(
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
