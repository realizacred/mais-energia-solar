-- Update proposal_update_status to handle atomic acceptance and financial snapshots
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
  v_latest_versao record;
  v_versao_status text;
  v_projeto_id uuid;
  v_deal_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  v_tenant_id := current_tenant_id();
  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_tenant');
  END IF;

  SELECT id, status, tenant_id, projeto_id, deal_id
    INTO v_proposta
    FROM propostas_nativas
   WHERE id = p_proposta_id
     AND tenant_id = v_tenant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  v_current_status := v_proposta.status;
  v_projeto_id := v_proposta.projeto_id;
  v_deal_id := v_proposta.deal_id;

  -- State machine (Portuguese labels as canonical input)
  v_allowed := CASE v_current_status
    WHEN 'rascunho'  THEN ARRAY['gerada', 'cancelada']
    WHEN 'gerada'    THEN ARRAY['enviada', 'aceita', 'recusada', 'cancelada', 'rascunho']
    WHEN 'enviada'   THEN ARRAY['vista', 'aceita', 'recusada', 'cancelada', 'gerada']
    WHEN 'vista'     THEN ARRAY['aceita', 'recusada', 'cancelada', 'gerada']
    WHEN 'aceita'    THEN ARRAY['recusada', 'cancelada', 'gerada']
    WHEN 'recusada'  THEN ARRAY['rascunho', 'gerada']
    WHEN 'expirada'  THEN ARRAY['gerada']
    WHEN 'cancelada' THEN ARRAY['rascunho']
    WHEN 'arquivada' THEN ARRAY['rascunho', 'gerada']
    ELSE ARRAY[]::text[]
  END;

  IF NOT (p_new_status = ANY(v_allowed)) AND v_current_status != p_new_status THEN
    RETURN jsonb_build_object(
      'error', 'invalid_transition',
      'current_status', v_current_status,
      'requested_status', p_new_status,
      'allowed', to_jsonb(v_allowed)
    );
  END IF;

  -- 1. Fetch latest version details BEFORE update for snapshots
  SELECT id, valor_total, potencia_kwp, snapshot 
    INTO v_latest_versao
    FROM proposta_versoes
   WHERE proposta_id = p_proposta_id
   ORDER BY versao_numero DESC
   LIMIT 1;

  -- 2. Update propostas_nativas
  UPDATE propostas_nativas
     SET status = p_new_status,
         updated_at = now(),
         is_principal = CASE WHEN p_new_status = 'aceita' THEN true ELSE is_principal END,
         aceita_at = CASE WHEN p_new_status = 'aceita' THEN now() ELSE aceita_at END,
         aceite_motivo = CASE WHEN p_new_status = 'aceita' THEN p_motivo ELSE aceite_motivo END,
         recusada_at = CASE WHEN p_new_status = 'recusada' THEN now() ELSE recusada_at END,
         recusa_motivo = CASE WHEN p_new_status = 'recusada' THEN p_motivo ELSE recusa_motivo END
   WHERE id = p_proposta_id
     AND tenant_id = v_tenant_id;

  -- 3. Sync proposal_versoes (English labels)
  v_versao_status := CASE p_new_status
    WHEN 'rascunho'  THEN 'draft'
    WHEN 'gerada'    THEN 'generated'
    WHEN 'enviada'   THEN 'sent'
    WHEN 'vista'     THEN 'viewed'
    WHEN 'aceita'    THEN 'accepted'
    WHEN 'recusada'  THEN 'rejected'
    WHEN 'expirada'  THEN 'expired'
    WHEN 'cancelada' THEN 'cancelled'
    ELSE p_new_status
  END;

  IF v_latest_versao.id IS NOT NULL THEN
    UPDATE proposta_versoes
       SET status = v_versao_status,
           updated_at = now()
     WHERE id = v_latest_versao.id;
  END IF;

  -- 4. Atomic Side Effects on Acceptance
  IF p_new_status = 'aceita' THEN
    -- 4a. Update Deal to won and sync value
    IF v_deal_id IS NOT NULL THEN
      UPDATE deals 
         SET status = 'won', 
             value = COALESCE(v_latest_versao.valor_total, value),
             updated_at = now()
       WHERE id = v_deal_id AND (status != 'won' OR value IS DISTINCT FROM v_latest_versao.valor_total);
    ELSIF v_projeto_id IS NOT NULL THEN
      UPDATE deals 
         SET status = 'won',
             value = COALESCE(v_latest_versao.valor_total, value),
             updated_at = now()
       WHERE projeto_id = v_projeto_id AND (status != 'won' OR value IS DISTINCT FROM v_latest_versao.valor_total);
    END IF;

    -- 4b. Sync Projeto value and KWp (FINANCIAL SNAPSHOT)
    IF v_projeto_id IS NOT NULL THEN
      UPDATE projetos
         SET valor_total = COALESCE(v_latest_versao.valor_total, valor_total),
             potencia_kwp = COALESCE(v_latest_versao.potencia_kwp, potencia_kwp),
             snapshot_financeiro = v_latest_versao.snapshot, -- Congela o snapshot da versão aceita
             updated_at = now()
       WHERE id = v_projeto_id;
    END IF;

    -- 4c. Unset is_principal and reject siblings
    IF v_projeto_id IS NOT NULL THEN
      UPDATE propostas_nativas
         SET is_principal = false,
             updated_at = now()
       WHERE projeto_id = v_projeto_id
         AND id != p_proposta_id;

      UPDATE propostas_nativas
         SET status = 'recusada',
             recusa_motivo = 'Outra proposta do projeto foi aceita',
             recusada_at = now(),
             updated_at = now()
       WHERE projeto_id = v_projeto_id
         AND id != p_proposta_id
         AND status IN ('rascunho', 'gerada', 'enviada', 'vista');
    END IF;
  END IF;

  -- 5. Event log
  BEGIN
    INSERT INTO proposal_events (proposta_id, tenant_id, tipo, payload, user_id)
    VALUES (p_proposta_id, v_tenant_id, 'status_change', jsonb_build_object(
      'previous_status', v_current_status,
      'new_status', p_new_status,
      'motivo', coalesce(p_motivo, ''),
      'valor_fechado', v_latest_versao.valor_total,
      'potencia_fechada', v_latest_versao.potencia_kwp
    ), v_user_id);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'proposta_id', p_proposta_id,
    'previous_status', v_current_status,
    'new_status', p_new_status,
    'valor_total', v_latest_versao.valor_total
  );
END;
$$;

-- Update proposal_reabrir to use Portuguese labels consistently
CREATE OR REPLACE FUNCTION public.proposal_reabrir(
  p_proposta_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposta record;
  v_has_admin_role boolean;
  v_status_anterior text;
  v_novo_status text;
BEGIN
  -- Check roles
  SELECT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = p_user_id 
      AND role IN ('admin'::app_role, 'gerente'::app_role, 'super_admin'::app_role)
  ) INTO v_has_admin_role;

  IF NOT v_has_admin_role THEN
    RETURN jsonb_build_object('error', 'Sem permissão para reabrir propostas.');
  END IF;

  SELECT * INTO v_proposta FROM propostas_nativas WHERE id = p_proposta_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Proposta não encontrada');
  END IF;

  IF v_proposta.status NOT IN ('aceita', 'recusada') THEN
    RETURN jsonb_build_object('error', 'Apenas propostas aceitas ou recusadas podem ser reabertas');
  END IF;

  v_status_anterior := v_proposta.status;
  v_novo_status := 'enviada';

  UPDATE propostas_nativas SET
    status = v_novo_status,
    updated_at = NOW()
  WHERE id = p_proposta_id;

  -- Sync version back to 'sent'
  UPDATE proposta_versoes SET
    status = 'sent',
    updated_at = NOW()
  WHERE proposta_id = p_proposta_id
    AND versao_numero = v_proposta.versao_atual;

  INSERT INTO proposal_events (proposta_id, tenant_id, user_id, tipo, payload)
  VALUES (p_proposta_id, v_proposta.tenant_id, p_user_id, 'reaberta', jsonb_build_object(
    'status_anterior', v_status_anterior,
    'novo_status', v_novo_status
  ));

  RETURN jsonb_build_object(
    'success', true,
    'status_anterior', v_status_anterior,
    'novo_status', v_novo_status
  );
END;
$$;