-- Fix proposal_delete: remove direct INSERT into audit_logs (blocked by guard trigger)
-- The audit_propostas_nativas trigger already captures the UPDATE on propostas_nativas
CREATE OR REPLACE FUNCTION public.proposal_delete(p_proposta_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
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

  UPDATE propostas_nativas
     SET status = 'excluida',
         deleted_at = now(),
         updated_at = now()
   WHERE id = p_proposta_id
     AND tenant_id = v_tenant_id;

  -- Audit is handled automatically by audit_propostas_nativas trigger on UPDATE
  -- Event log (optional, won't fail)
  BEGIN
    INSERT INTO proposal_events (proposta_id, tenant_id, tipo, payload)
    VALUES (p_proposta_id, v_tenant_id, 'deleted', jsonb_build_object(
      'previous_status', v_current_status,
      'deleted_by', v_user_id
    ));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'proposta_id', p_proposta_id,
    'previous_status', v_current_status
  );
END;
$$;

-- Fix proposal_update_status: remove direct INSERT into audit_logs
CREATE OR REPLACE FUNCTION public.proposal_update_status(
  p_proposta_id uuid,
  p_new_status text,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
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

  UPDATE propostas_nativas
     SET status = p_new_status,
         updated_at = now()
   WHERE id = p_proposta_id
     AND tenant_id = v_tenant_id;

  -- Audit is handled automatically by audit_propostas_nativas trigger on UPDATE
  -- Event log (optional, won't fail)
  BEGIN
    INSERT INTO proposal_events (proposta_id, tenant_id, tipo, payload)
    VALUES (p_proposta_id, v_tenant_id, 'status_change', jsonb_build_object(
      'previous_status', v_current_status,
      'new_status', p_new_status,
      'motivo', coalesce(p_motivo, ''),
      'changed_by', v_user_id
    ));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'proposta_id', p_proposta_id,
    'previous_status', v_current_status,
    'new_status', p_new_status
  );
END;
$$;