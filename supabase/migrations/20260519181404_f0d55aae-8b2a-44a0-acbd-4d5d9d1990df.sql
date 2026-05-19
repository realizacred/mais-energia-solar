-- 1. Restaurar compatibilidade legada via VIEW (Shim)
-- Isso resolve imediatamente o erro de "relation public.pagamentos does not exist" para todas as funções e triggers
CREATE OR REPLACE VIEW public.pagamentos AS 
SELECT * FROM public._deprecated_pagamentos;

-- 2. Atualizar fn_reopen_deal para ser mais resiliente e performática
-- Usando total_pago da tabela recebimentos em vez de join com pagamentos
CREATE OR REPLACE FUNCTION public.fn_reopen_deal(p_deal_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deal public.deals%ROWTYPE;
  v_target_stage_id uuid;
  v_target_stage_name text;
  v_user uuid := auth.uid();
  v_has_payments boolean;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF coalesce(trim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'Motivo é obrigatório para reabrir uma negociação.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_deal FROM public.deals WHERE id = p_deal_id;

  IF v_deal.id IS NULL THEN
    RAISE EXCEPTION 'Deal % não encontrado.', p_deal_id USING ERRCODE = 'no_data_found';
  END IF;

  IF v_deal.status NOT IN ('won','lost','canceled') THEN
    RAISE EXCEPTION 'Deal já está aberto (status=%). Reabertura não aplicável.', v_deal.status USING ERRCODE = 'check_violation';
  END IF;

  -- Buscar a primeira etapa "aberta" (não closed) do pipeline atual, ordenada por position
  SELECT id, name INTO v_target_stage_id, v_target_stage_name
  FROM public.pipeline_stages
  WHERE pipeline_id = v_deal.pipeline_id
    AND coalesce(is_closed, false) = false
  ORDER BY position ASC
  LIMIT 1;

  IF v_target_stage_id IS NULL THEN
    RAISE EXCEPTION 'Pipeline % não possui etapa aberta para retornar a negociação.', v_deal.pipeline_id USING ERRCODE = 'no_data_found';
  END IF;

  -- Detectar impacto financeiro (apenas informativo)
  -- Usamos total_pago dos recebimentos vinculados ao projeto
  SELECT EXISTS (
    SELECT 1 FROM public.recebimentos r
    WHERE r.projeto_id = v_deal.projeto_id
      AND coalesce(r.total_pago, 0) > 0
  ) INTO v_has_payments;

  -- Atualizar deal
  UPDATE public.deals
  SET status = 'open',
      stage_id = v_target_stage_id,
      previous_status = v_deal.status,
      reopened_at = now(),
      reopened_by = v_user,
      reopened_reason = p_reason,
      reopened_count = coalesce(v_deal.reopened_count, 0) + 1,
      updated_at = now()
  WHERE id = p_deal_id;

  -- Auditoria
  INSERT INTO public.financial_audit_logs (
    tenant_id, actor_id, entity_type, entity_id, action,
    before_data, after_data, reason
  ) VALUES (
    v_deal.tenant_id, v_user, 'deal', p_deal_id, 'commercial_state_reverted',
    jsonb_build_object(
      'status', v_deal.status,
      'stage_id', v_deal.stage_id,
      'reopened_count', coalesce(v_deal.reopened_count, 0)
    ),
    jsonb_build_object(
      'status', 'open',
      'stage_id', v_target_stage_id,
      'stage_name', v_target_stage_name,
      'reopened_count', coalesce(v_deal.reopened_count, 0) + 1,
      'has_payments', v_has_payments
    ),
    'Reabertura comercial: ' || p_reason
  );

  RETURN jsonb_build_object(
    'deal_id', p_deal_id,
    'previous_status', v_deal.status,
    'new_status', 'open',
    'new_stage_id', v_target_stage_id,
    'new_stage_name', v_target_stage_name,
    'reopened_count', coalesce(v_deal.reopened_count, 0) + 1,
    'has_payments', v_has_payments
  );
END;
$function$;