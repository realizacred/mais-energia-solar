
-- 1) Atualiza a função reset_project_area removendo a referência a proposta_premissas
CREATE OR REPLACE FUNCTION public.reset_project_area(p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '120s'
AS $function$
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
  UPDATE projetos SET funil_id = NULL, etapa_id = NULL, deal_id = NULL, proposta_id = NULL
  WHERE tenant_id = p_tenant_id;

  UPDATE proposta_versoes SET substituida_por = NULL
  WHERE tenant_id = p_tenant_id;

  DELETE FROM proposta_views WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_envios WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_aceite_tokens WHERE tenant_id = p_tenant_id;

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
  -- proposta_premissas removida: dados vivem em proposta_versoes.snapshot.premissas
  DELETE FROM proposta_renders WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_resultados_energia WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_series WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_servicos WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_ucs WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_venda WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_versao_servicos WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_versao_ucs WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_versao_variaveis WHERE tenant_id = p_tenant_id;

  WITH del AS (
    DELETE FROM proposta_versoes
    WHERE proposta_id IN (SELECT id FROM propostas_nativas WHERE tenant_id = p_tenant_id)
    RETURNING 1
  ) SELECT count(*) INTO v_versoes FROM del;

  DELETE FROM proposal_events WHERE tenant_id = p_tenant_id;
  DELETE FROM proposal_followup_queue WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_historico WHERE tenant_id = p_tenant_id;
  DELETE FROM proposta_grupo_tokens WHERE tenant_id = p_tenant_id;

  WITH del AS (
    DELETE FROM propostas_nativas WHERE tenant_id = p_tenant_id RETURNING 1
  ) SELECT count(*) INTO v_propostas FROM del;

  WITH del AS (
    DELETE FROM generated_documents WHERE tenant_id = p_tenant_id RETURNING 1
  ) SELECT count(*) INTO v_documentos FROM del;

  WITH del AS (
    DELETE FROM comissoes WHERE tenant_id = p_tenant_id RETURNING 1
  ) SELECT count(*) INTO v_comissoes FROM del;

  WITH del AS (
    DELETE FROM recebimentos WHERE tenant_id = p_tenant_id RETURNING 1
  ) SELECT count(*) INTO v_recebimentos FROM del;

  DELETE FROM checklist_cliente_arquivos WHERE tenant_id = p_tenant_id;
  DELETE FROM checklist_cliente_respostas WHERE tenant_id = p_tenant_id;
  DELETE FROM checklists_cliente WHERE tenant_id = p_tenant_id;
  DELETE FROM checklist_instalador_arquivos WHERE tenant_id = p_tenant_id;
  DELETE FROM checklist_instalador_respostas WHERE tenant_id = p_tenant_id;
  WITH del AS (
    DELETE FROM checklists_instalador WHERE tenant_id = p_tenant_id RETURNING 1
  ) SELECT count(*) INTO v_checklists FROM del;
  DELETE FROM checklists_instalacao WHERE tenant_id = p_tenant_id;

  DELETE FROM deal_custom_field_values WHERE deal_id IN (SELECT id FROM deals WHERE tenant_id = p_tenant_id);
  DELETE FROM deal_activities WHERE deal_id IN (SELECT id FROM deals WHERE tenant_id = p_tenant_id);
  DELETE FROM deal_notes WHERE deal_id IN (SELECT id FROM deals WHERE tenant_id = p_tenant_id);
  DELETE FROM deal_stage_history WHERE deal_id IN (SELECT id FROM deals WHERE tenant_id = p_tenant_id);
  DELETE FROM deal_pipeline_stages WHERE tenant_id = p_tenant_id;
  DELETE FROM deal_kanban_projection WHERE tenant_id = p_tenant_id;
  DELETE FROM doc_checklist_status WHERE tenant_id = p_tenant_id;
  DELETE FROM pipeline_automation_logs WHERE tenant_id = p_tenant_id;
  DELETE FROM project_events WHERE tenant_id = p_tenant_id;

  WITH del AS (
    DELETE FROM deals WHERE tenant_id = p_tenant_id RETURNING 1
  ) SELECT count(*) INTO v_deals FROM del;

  WITH del AS (
    DELETE FROM projetos WHERE tenant_id = p_tenant_id RETURNING 1
  ) SELECT count(*) INTO v_projetos FROM del;

  WITH del AS (
    DELETE FROM appointments WHERE tenant_id = p_tenant_id RETURNING 1
  ) SELECT count(*) INTO v_appointments FROM del;

  WITH del AS (
    DELETE FROM clientes WHERE tenant_id = p_tenant_id RETURNING 1
  ) SELECT count(*) INTO v_clientes FROM del;

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
$function$;

-- 2) Drop da tabela vazia
DROP TABLE IF EXISTS public.proposta_premissas;
