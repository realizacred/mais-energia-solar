-- Fix proposal_delete: invalidate active tokens when proposal is deleted
-- Also add purge function for expired tokens

DROP FUNCTION IF EXISTS public.proposal_delete(uuid);

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
  v_invalidated_tokens integer;
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

  -- Soft delete the proposal
  UPDATE propostas_nativas
     SET status = 'excluida',
         deleted_at = now(),
         updated_at = now()
   WHERE id = p_proposta_id
     AND tenant_id = v_tenant_id;

  -- Invalidate all active tokens (that have not been used for acceptance)
  UPDATE proposta_aceite_tokens
     SET invalidado_em = now(),
         motivo_invalidacao = 'proposta_excluida'
   WHERE proposta_id = p_proposta_id
     AND invalidado_em IS NULL
     AND used_at IS NULL;

  GET DIAGNOSTICS v_invalidated_tokens = ROW_COUNT;

  -- Event log (optional, won't fail)
  BEGIN
    INSERT INTO proposal_events (proposta_id, tenant_id, tipo, payload)
    VALUES (p_proposta_id, v_tenant_id, 'deleted', jsonb_build_object(
      'previous_status', v_current_status,
      'deleted_by', v_user_id,
      'tokens_invalidated', v_invalidated_tokens
    ));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'proposta_id', p_proposta_id,
    'previous_status', v_current_status,
    'tokens_invalidated', v_invalidated_tokens
  );
END;
$$;

-- Purge function for old expired tokens (maintenance, run monthly)
CREATE OR REPLACE FUNCTION public.purge_expired_proposal_tokens()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM proposta_aceite_tokens
  WHERE expires_at < now() - interval '90 days'
    AND used_at IS NULL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;