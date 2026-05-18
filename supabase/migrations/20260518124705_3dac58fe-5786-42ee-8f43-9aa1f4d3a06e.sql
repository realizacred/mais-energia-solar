-- 1. Drop the broken trigger and its function
DROP TRIGGER IF EXISTS trg_assign_client_code ON public.clientes;
DROP FUNCTION IF EXISTS public.trg_fn_assign_client_code();

-- 2. Fix reset_project_area to use the generic tenant_counters structure
CREATE OR REPLACE FUNCTION public.reset_project_area(p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '180s'
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
  v_vendas       int := 0;
BEGIN
  -- Quebrar auto-referências para permitir DELETE
  UPDATE projetos SET funil_id = NULL, etapa_id = NULL, deal_id = NULL, proposta_id = NULL
  WHERE tenant_id = p_tenant_id;

  UPDATE proposta_versoes SET substituida_por = NULL
  WHERE tenant_id = p_tenant_id;

  -- ====== FK RESTRICT blockers ======
  DELETE FROM vendas_transacional WHERE tenant_id = p_tenant_id;
  DELETE FROM recibos_emitidos WHERE tenant_id = p_tenant_id;

  -- ====== Camada PROPOSTAS ======
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

  -- ====== Documentos / Financeiro ======
  WITH del AS (
    DELETE FROM generated_documents WHERE tenant_id = p_tenant_id RETURNING 1
  ) SELECT count(*) INTO v_documentos FROM del;

  WITH del AS (
    DELETE FROM comissoes WHERE tenant_id = p_tenant_id RETURNING 1
  ) SELECT count(*) INTO v_comissoes FROM del;

  WITH del AS (
    DELETE FROM recebimentos WHERE tenant_id = p_tenant_id RETURNING 1
  ) SELECT count(*) INTO v_recebimentos FROM del;

  WITH del AS (
    DELETE FROM vendas WHERE tenant_id = p_tenant_id RETURNING 1
  ) SELECT count(*) INTO v_vendas FROM del;

  DELETE FROM lancamentos_financeiros WHERE tenant_id = p_tenant_id;
  DELETE FROM fiscal_invoices WHERE tenant_id = p_tenant_id;
  DELETE FROM ordens_compra WHERE tenant_id = p_tenant_id;

  -- ====== Checklists ======
  DELETE FROM checklist_cliente_arquivos WHERE tenant_id = p_tenant_id;
  DELETE FROM checklist_cliente_respostas WHERE tenant_id = p_tenant_id;
  DELETE FROM checklists_cliente WHERE tenant_id = p_tenant_id;
  DELETE FROM checklist_instalador_arquivos WHERE tenant_id = p_tenant_id;
  DELETE FROM checklist_instalador_respostas WHERE tenant_id = p_tenant_id;
  WITH del AS (
    DELETE FROM checklists_instalador WHERE tenant_id = p_tenant_id RETURNING 1
  ) SELECT count(*) INTO v_checklists FROM del;
  DELETE FROM checklists_instalacao WHERE tenant_id = p_tenant_id;

  -- ====== Pós-vendas / Operações ======
  DELETE FROM post_sale_visits WHERE tenant_id = p_tenant_id;
  DELETE FROM post_sale_upsell_opportunities WHERE tenant_id = p_tenant_id;
  DELETE FROM post_sale_tasks WHERE tenant_id = p_tenant_id;
  DELETE FROM post_sale_maintenance_plans WHERE tenant_id = p_tenant_id;

  -- ====== Funil / CRM ======
  DELETE FROM deal_events WHERE tenant_id = p_tenant_id;
  DELETE FROM deal_tasks WHERE tenant_id = p_tenant_id;
  DELETE FROM lead_activities WHERE tenant_id = p_tenant_id;
  DELETE FROM pipeline_automations WHERE tenant_id = p_tenant_id;
  DELETE FROM pipeline_history WHERE tenant_id = p_tenant_id;
  
  WITH del AS (
    DELETE FROM deals WHERE tenant_id = p_tenant_id RETURNING 1
  ) SELECT count(*) INTO v_deals FROM del;

  -- ====== PROJETOS ======
  WITH del AS (
    DELETE FROM projetos WHERE tenant_id = p_tenant_id RETURNING 1
  ) SELECT count(*) INTO v_projetos FROM del;

  -- ====== Vínculos externos ======
  DELETE FROM external_entity_links WHERE tenant_id = p_tenant_id;

  -- ====== CLIENTES (por último) ======
  WITH del AS (
    DELETE FROM clientes WHERE tenant_id = p_tenant_id RETURNING 1
  ) SELECT count(*) INTO v_clientes FROM del;

  -- ====== Reset de contadores (CORRIGIDO) ======
  DELETE FROM public.tenant_counters 
  WHERE tenant_id = p_tenant_id 
  AND entity IN ('cliente', 'projeto', 'proposta', 'deal');

  RETURN jsonb_build_object(
    'clientes', v_clientes,
    'projetos', v_projetos,
    'deals', v_deals,
    'propostas', v_propostas,
    'versoes', v_versoes,
    'documentos', v_documentos,
    'comissoes', v_comissoes,
    'recebimentos', v_recebimentos,
    'vendas', v_vendas,
    'checklists', v_checklists
  );
END;
$function$;

-- 3. Fix fn_generate_client_code to use next_tenant_number
CREATE OR REPLACE FUNCTION public.fn_generate_client_code(_tenant_id uuid, _prefix text DEFAULT 'CLI'::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    _year TEXT;
    _new_val BIGINT;
    _final_code TEXT;
BEGIN
    _year := to_char(now(), 'YYYY');
    
    -- Use the generic sequence generator
    _new_val := public.next_tenant_number(_tenant_id, 'cliente');

    _final_code := _prefix || '-' || _year || '-' || LPAD(_new_val::TEXT, 4, '0');
    
    RETURN _final_code;
END;
$function$;
