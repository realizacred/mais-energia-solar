-- Limpa o resíduo (2.356 vínculos) deixado pelo reset anterior
-- e atualiza a função reset_migrated_data para incluir TODAS as tabelas raw do SM.

TRUNCATE TABLE public.sm_projeto_funis_raw;
TRUNCATE TABLE public.sm_clientes_raw;
TRUNCATE TABLE public.sm_projetos_raw;
TRUNCATE TABLE public.sm_propostas_raw;
TRUNCATE TABLE public.sm_funis_raw;
TRUNCATE TABLE public.sm_custom_fields_raw;

-- Atualiza a RPC reset_migrated_data para também truncar as tabelas raw do staging
CREATE OR REPLACE FUNCTION public.reset_migrated_data(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blocking_op text;
  v_deleted jsonb := '{}'::jsonb;
  v_count int;
BEGIN
  -- Guard opcional contra concorrência (apenas se as tabelas existirem)
  IF to_regclass('public.sm_operation_runs') IS NOT NULL THEN
    EXECUTE 'SELECT operation_type FROM public.sm_operation_runs
             WHERE tenant_id = $1 AND status IN (''running'',''queued'') LIMIT 1'
      INTO v_blocking_op USING p_tenant_id;
    IF v_blocking_op IS NOT NULL THEN
      RAISE EXCEPTION 'Operação % em andamento. Aguarde ou cancele antes de resetar.', v_blocking_op;
    END IF;
  END IF;

  -- Apaga dados migrados (deals, projetos, propostas, clientes derivados do SM)
  DELETE FROM public.deal_kanban_projection
   WHERE deal_id IN (SELECT id FROM public.deals WHERE tenant_id = p_tenant_id AND external_source = 'solar_market');
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('deal_kanban_projection', v_count);

  DELETE FROM public.proposta_versoes
   WHERE proposta_id IN (
     SELECT id FROM public.propostas_nativas
      WHERE tenant_id = p_tenant_id
        AND projeto_id IN (SELECT id FROM public.projetos WHERE tenant_id = p_tenant_id AND external_source = 'solar_market')
   );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('proposta_versoes', v_count);

  DELETE FROM public.propostas_nativas
   WHERE tenant_id = p_tenant_id
     AND projeto_id IN (SELECT id FROM public.projetos WHERE tenant_id = p_tenant_id AND external_source = 'solar_market');
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('propostas_nativas', v_count);

  DELETE FROM public.deals WHERE tenant_id = p_tenant_id AND external_source = 'solar_market';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('deals', v_count);

  DELETE FROM public.projetos WHERE tenant_id = p_tenant_id AND external_source = 'solar_market';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('projetos', v_count);

  DELETE FROM public.clientes WHERE tenant_id = p_tenant_id AND external_source = 'solar_market';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted := v_deleted || jsonb_build_object('clientes', v_count);

  -- Limpa todas as tabelas de STAGING / RAW do SolarMarket (origem dos "Vínculos")
  TRUNCATE TABLE public.sm_projeto_funis_raw;
  TRUNCATE TABLE public.sm_clientes_raw;
  TRUNCATE TABLE public.sm_projetos_raw;
  TRUNCATE TABLE public.sm_propostas_raw;
  TRUNCATE TABLE public.sm_funis_raw;
  TRUNCATE TABLE public.sm_custom_fields_raw;
  v_deleted := v_deleted || jsonb_build_object('sm_raw_tables', 'truncated');

  RETURN jsonb_build_object('success', true, 'deleted', v_deleted);
END;
$$;