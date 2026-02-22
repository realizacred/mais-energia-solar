
CREATE OR REPLACE FUNCTION public.delete_seed_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_deal_ids uuid[];
  v_proposta_ids uuid[];
  v_projeto_ids uuid[];
  v_cnt int;
  v_total int := 0;
  v_result jsonb := '{}';
BEGIN
  v_tenant_id := require_tenant_id();

  -- 1) Collect seed deal IDs
  SELECT array_agg(id) INTO v_deal_ids
  FROM deals WHERE tenant_id = v_tenant_id AND title ILIKE 'Projeto Seed%';
  v_deal_ids := COALESCE(v_deal_ids, '{}');

  -- 2) Collect seed proposta IDs
  SELECT array_agg(id) INTO v_proposta_ids
  FROM propostas_nativas WHERE tenant_id = v_tenant_id AND titulo ILIKE 'Proposta Seed%';
  v_proposta_ids := COALESCE(v_proposta_ids, '{}');

  -- 3) Collect projeto IDs linked to seed deals
  SELECT array_agg(id) INTO v_projeto_ids
  FROM projetos WHERE tenant_id = v_tenant_id AND deal_id = ANY(v_deal_ids);
  v_projeto_ids := COALESCE(v_projeto_ids, '{}');

  -- ═══ Delete children of propostas ═══
  DELETE FROM proposta_versoes WHERE tenant_id = v_tenant_id AND proposta_id = ANY(v_proposta_ids);
  GET DIAGNOSTICS v_cnt = ROW_COUNT; v_total := v_total + v_cnt;
  v_result := v_result || jsonb_build_object('proposta_versoes_deleted', v_cnt);

  DELETE FROM propostas_nativas WHERE tenant_id = v_tenant_id AND id = ANY(v_proposta_ids);
  GET DIAGNOSTICS v_cnt = ROW_COUNT; v_total := v_total + v_cnt;
  v_result := v_result || jsonb_build_object('propostas_deleted', v_cnt);

  -- ═══ Delete children of projetos ═══
  DELETE FROM checklists_cliente WHERE tenant_id = v_tenant_id AND projeto_id = ANY(v_projeto_ids);
  GET DIAGNOSTICS v_cnt = ROW_COUNT; v_total := v_total + v_cnt;

  DELETE FROM checklists_instalador WHERE tenant_id = v_tenant_id AND projeto_id = ANY(v_projeto_ids);
  GET DIAGNOSTICS v_cnt = ROW_COUNT; v_total := v_total + v_cnt;

  DELETE FROM comissoes WHERE tenant_id = v_tenant_id AND projeto_id = ANY(v_projeto_ids);
  GET DIAGNOSTICS v_cnt = ROW_COUNT; v_total := v_total + v_cnt;

  DELETE FROM layouts_solares WHERE tenant_id = v_tenant_id AND projeto_id = ANY(v_projeto_ids);
  GET DIAGNOSTICS v_cnt = ROW_COUNT; v_total := v_total + v_cnt;

  DELETE FROM obras WHERE tenant_id = v_tenant_id AND projeto_id = ANY(v_projeto_ids);
  GET DIAGNOSTICS v_cnt = ROW_COUNT; v_total := v_total + v_cnt;

  DELETE FROM os_instalacao WHERE tenant_id = v_tenant_id AND projeto_id = ANY(v_projeto_ids);
  GET DIAGNOSTICS v_cnt = ROW_COUNT; v_total := v_total + v_cnt;

  -- projeto_etiqueta_rel has NO tenant_id column, filter by projeto_id only
  DELETE FROM projeto_etiqueta_rel WHERE projeto_id = ANY(v_projeto_ids);
  GET DIAGNOSTICS v_cnt = ROW_COUNT; v_total := v_total + v_cnt;

  DELETE FROM servicos_agendados WHERE tenant_id = v_tenant_id AND projeto_id = ANY(v_projeto_ids);
  GET DIAGNOSTICS v_cnt = ROW_COUNT; v_total := v_total + v_cnt;

  -- ═══ Delete children of deals ═══
  DELETE FROM deal_activities WHERE deal_id = ANY(v_deal_ids);
  GET DIAGNOSTICS v_cnt = ROW_COUNT; v_total := v_total + v_cnt;

  DELETE FROM deal_custom_field_values WHERE deal_id = ANY(v_deal_ids);
  GET DIAGNOSTICS v_cnt = ROW_COUNT; v_total := v_total + v_cnt;

  DELETE FROM deal_kanban_projection WHERE deal_id = ANY(v_deal_ids);
  GET DIAGNOSTICS v_cnt = ROW_COUNT; v_total := v_total + v_cnt;

  DELETE FROM deal_notes WHERE deal_id = ANY(v_deal_ids);
  GET DIAGNOSTICS v_cnt = ROW_COUNT; v_total := v_total + v_cnt;

  DELETE FROM deal_pipeline_stages WHERE deal_id = ANY(v_deal_ids);
  GET DIAGNOSTICS v_cnt = ROW_COUNT; v_total := v_total + v_cnt;

  DELETE FROM deal_stage_history WHERE deal_id = ANY(v_deal_ids);
  GET DIAGNOSTICS v_cnt = ROW_COUNT; v_total := v_total + v_cnt;

  DELETE FROM generated_documents WHERE deal_id = ANY(v_deal_ids) OR projeto_id = ANY(v_projeto_ids);
  GET DIAGNOSTICS v_cnt = ROW_COUNT; v_total := v_total + v_cnt;

  DELETE FROM pipeline_automation_logs WHERE deal_id = ANY(v_deal_ids);
  GET DIAGNOSTICS v_cnt = ROW_COUNT; v_total := v_total + v_cnt;

  DELETE FROM project_events WHERE deal_id = ANY(v_deal_ids);
  GET DIAGNOSTICS v_cnt = ROW_COUNT; v_total := v_total + v_cnt;

  -- ═══ Delete projetos ═══
  DELETE FROM projetos WHERE tenant_id = v_tenant_id AND id = ANY(v_projeto_ids);
  GET DIAGNOSTICS v_cnt = ROW_COUNT; v_total := v_total + v_cnt;
  v_result := v_result || jsonb_build_object('projetos_deleted', v_cnt);

  -- ═══ Delete deals ═══
  DELETE FROM deals WHERE tenant_id = v_tenant_id AND id = ANY(v_deal_ids);
  GET DIAGNOSTICS v_cnt = ROW_COUNT; v_total := v_total + v_cnt;
  v_result := v_result || jsonb_build_object('deals_deleted', v_cnt);

  -- ═══ Delete clientes seed ═══
  DELETE FROM clientes WHERE tenant_id = v_tenant_id
    AND (nome ILIKE 'Cliente Teste%' OR telefone = '11999990000');
  GET DIAGNOSTICS v_cnt = ROW_COUNT; v_total := v_total + v_cnt;
  v_result := v_result || jsonb_build_object('clientes_deleted', v_cnt);

  v_result := v_result || jsonb_build_object('total_deleted', v_total);

  RETURN v_result;
END;
$$;
