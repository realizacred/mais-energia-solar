-- Fix proposal_update_status: remove enum cast (status is text), fix registro_id type
CREATE OR REPLACE FUNCTION public.proposal_update_status(
  p_proposta_id uuid,
  p_new_status text,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_user_id uuid;
  v_current_status text;
  v_proposta record;
  v_allowed text[];
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  v_tenant_id := current_tenant_id();
  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_tenant');
  END IF;

  SELECT id, status, tenant_id
    INTO v_proposta
    FROM propostas_nativas
   WHERE id = p_proposta_id
     AND tenant_id = v_tenant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  v_current_status := v_proposta.status;

  v_allowed := CASE v_current_status
    WHEN 'rascunho'  THEN ARRAY['gerada']
    WHEN 'gerada'    THEN ARRAY['enviada', 'aceita', 'recusada', 'cancelada']
    WHEN 'enviada'   THEN ARRAY['vista', 'aceita', 'recusada', 'cancelada']
    WHEN 'vista'     THEN ARRAY['aceita', 'recusada', 'cancelada']
    WHEN 'aceita'    THEN ARRAY['cancelada']
    WHEN 'recusada'  THEN ARRAY['gerada', 'enviada']
    WHEN 'expirada'  THEN ARRAY['gerada']
    WHEN 'cancelada' THEN ARRAY[]::text[]
    WHEN 'arquivada' THEN ARRAY['rascunho', 'gerada']
    ELSE ARRAY[]::text[]
  END;

  IF NOT (p_new_status = ANY(v_allowed)) THEN
    RETURN jsonb_build_object(
      'error', 'invalid_transition',
      'current_status', v_current_status,
      'requested_status', p_new_status,
      'allowed', to_jsonb(v_allowed)
    );
  END IF;

  -- status column is TEXT, no enum cast needed
  UPDATE propostas_nativas
     SET status = p_new_status,
         updated_at = now()
   WHERE id = p_proposta_id
     AND tenant_id = v_tenant_id;

  -- registro_id is UUID, pass uuid directly
  INSERT INTO audit_logs (tenant_id, user_id, tabela, acao, registro_id, dados_anteriores, dados_novos)
  VALUES (
    v_tenant_id,
    v_user_id,
    'propostas_nativas',
    'status_change',
    p_proposta_id,
    jsonb_build_object('status', v_current_status),
    jsonb_build_object('status', p_new_status, 'motivo', coalesce(p_motivo, ''))
  );

  RETURN jsonb_build_object(
    'success', true,
    'proposta_id', p_proposta_id,
    'previous_status', v_current_status,
    'new_status', p_new_status
  );
END;
$$;

-- Fix proposal_delete: remove enum cast (status is text), fix registro_id type
CREATE OR REPLACE FUNCTION public.proposal_delete(p_proposta_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_user_id uuid;
  v_current_status text;
  v_proposta record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  v_tenant_id := current_tenant_id();
  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_tenant');
  END IF;

  SELECT id, status, tenant_id
    INTO v_proposta
    FROM propostas_nativas
   WHERE id = p_proposta_id
     AND tenant_id = v_tenant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  v_current_status := v_proposta.status;

  IF v_current_status = 'excluida' THEN
    RETURN jsonb_build_object('error', 'already_deleted', 'status', v_current_status);
  END IF;

  -- status column is TEXT, no enum cast needed
  UPDATE propostas_nativas
     SET status = 'excluida',
         deleted_at = now(),
         updated_at = now()
   WHERE id = p_proposta_id
     AND tenant_id = v_tenant_id;

  -- registro_id is UUID, pass uuid directly
  INSERT INTO audit_logs (tenant_id, user_id, tabela, acao, registro_id, dados_anteriores, dados_novos)
  VALUES (
    v_tenant_id,
    v_user_id,
    'propostas_nativas',
    'soft_delete',
    p_proposta_id,
    jsonb_build_object('status', v_current_status),
    jsonb_build_object('status', 'excluida', 'deleted_at', now())
  );

  RETURN jsonb_build_object(
    'success', true,
    'proposta_id', p_proposta_id,
    'previous_status', v_current_status
  );
END;
$$;