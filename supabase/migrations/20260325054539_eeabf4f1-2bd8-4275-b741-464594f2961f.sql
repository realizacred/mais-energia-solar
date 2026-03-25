
-- RPC proposal_delete: SECURITY DEFINER soft-delete with tenant validation and audit
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
  -- 1. Resolve caller
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  v_tenant_id := current_tenant_id();
  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_tenant');
  END IF;

  -- 2. Fetch proposta with tenant check
  SELECT id, status, tenant_id
    INTO v_proposta
    FROM propostas_nativas
   WHERE id = p_proposta_id
     AND tenant_id = v_tenant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  v_current_status := v_proposta.status::text;

  -- 3. Prevent double-delete
  IF v_current_status = 'excluida' THEN
    RETURN jsonb_build_object('error', 'already_deleted', 'status', v_current_status);
  END IF;

  -- 4. Soft delete
  UPDATE propostas_nativas
     SET status = 'excluida'::proposta_nativa_status,
         deleted_at = now(),
         updated_at = now()
   WHERE id = p_proposta_id
     AND tenant_id = v_tenant_id;

  -- 5. Audit log
  INSERT INTO audit_logs (tenant_id, user_id, tabela, acao, registro_id, dados_anteriores, dados_novos)
  VALUES (
    v_tenant_id,
    v_user_id,
    'propostas_nativas',
    'soft_delete',
    p_proposta_id::text,
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
