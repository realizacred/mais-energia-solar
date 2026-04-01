DROP FUNCTION IF EXISTS public.proposal_delete(uuid);

CREATE FUNCTION public.proposal_delete(p_proposta_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_user_id uuid;
  v_deal_id uuid;
  v_current_status text;
  v_invalidated_tokens integer;
  v_deleted_checklists integer := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  v_tenant_id := current_tenant_id();
  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_tenant');
  END IF;

  SELECT id, status, deal_id
    INTO p_proposta_id, v_current_status, v_deal_id
    FROM propostas_nativas
   WHERE id = p_proposta_id
     AND tenant_id = v_tenant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

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

  -- Invalidate active tokens
  UPDATE proposta_aceite_tokens
     SET invalidado_em = now(),
         motivo_invalidacao = 'proposta_excluida'
   WHERE proposta_id = p_proposta_id
     AND invalidado_em IS NULL
     AND used_at IS NULL;

  GET DIAGNOSTICS v_invalidated_tokens = ROW_COUNT;

  -- If no more active proposals remain in the project, delete installation checklists
  IF v_deal_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM propostas_nativas
       WHERE deal_id = v_deal_id
         AND status NOT IN ('excluida')
         AND deleted_at IS NULL
         AND id != p_proposta_id
    ) THEN
      DELETE FROM checklists_instalador
       WHERE projeto_id = v_deal_id
         AND tenant_id = v_tenant_id;

      GET DIAGNOSTICS v_deleted_checklists = ROW_COUNT;
    END IF;
  END IF;

  -- Event log
  BEGIN
    INSERT INTO proposal_events (proposta_id, tenant_id, tipo, payload)
    VALUES (p_proposta_id, v_tenant_id, 'deleted', jsonb_build_object(
      'previous_status', v_current_status,
      'deleted_by', v_user_id,
      'tokens_invalidated', v_invalidated_tokens,
      'checklists_deleted', v_deleted_checklists
    ));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'proposta_id', p_proposta_id,
    'previous_status', v_current_status,
    'tokens_invalidated', v_invalidated_tokens,
    'checklists_deleted', v_deleted_checklists
  );
END;
$$;