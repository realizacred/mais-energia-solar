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
  v_canonical_status text;
  v_projeto_id uuid;
  v_deal_id uuid;
BEGIN
  -- 1. Authentication and Authorization
  v_user_id := auth.uid();
  -- For public-action, auth.uid() might be null if called via service_role in edge function
  -- But usually it's better to ensure we have a tenant context.
  
  v_tenant_id := current_tenant_id();
  IF v_tenant_id IS NULL THEN
    -- Fallback for service role calls without direct auth context
    SELECT tenant_id INTO v_tenant_id FROM propostas_nativas WHERE id = p_proposta_id;
  END IF;

  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_tenant');
  END IF;

  -- 2. Load Proposal
  SELECT id, status, tenant_id, projeto_id, deal_id
    INTO v_proposta
    FROM propostas_nativas
   WHERE id = p_proposta_id
     AND tenant_id = v_tenant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  v_current_status := COALESCE(v_proposta.status, 'draft');
  v_projeto_id := v_proposta.projeto_id;
  v_deal_id := v_proposta.deal_id;

  -- 3. Normalize status to canonical English
  v_canonical_status := CASE p_new_status
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

  -- 4. Canonical State Machine
  v_allowed := CASE v_current_status
    WHEN 'draft'     THEN ARRAY['generated', 'cancelled']
    WHEN 'generated' THEN ARRAY['sent', 'accepted', 'rejected', 'cancelled', 'draft']
    WHEN 'sent'      THEN ARRAY['viewed', 'accepted', 'rejected', 'expired', 'cancelled', 'generated']
    WHEN 'viewed'    THEN ARRAY['accepted', 'rejected', 'expired', 'cancelled', 'generated']
    WHEN 'accepted'  THEN ARRAY['rejected', 'cancelled', 'generated']
    WHEN 'rejected'  THEN ARRAY['draft', 'generated']
    WHEN 'expired'   THEN ARRAY['generated', 'draft']
    WHEN 'cancelled' THEN ARRAY['draft']
    WHEN 'excluida'  THEN ARRAY[]::text[]
    ELSE ARRAY[]::text[]
  END;

  -- Normalização de estados atuais em PT se existirem no banco
  IF v_current_status = 'rascunho' THEN v_allowed := ARRAY['generated', 'cancelled']; END IF;
  IF v_current_status = 'gerada'   THEN v_allowed := ARRAY['sent', 'accepted', 'rejected', 'cancelled', 'draft']; END IF;
  IF v_current_status = 'enviada'  THEN v_allowed := ARRAY['viewed', 'accepted', 'rejected', 'expired', 'cancelled', 'generated']; END IF;
  IF v_current_status = 'aceita'   THEN v_allowed := ARRAY['rejected', 'cancelled', 'generated']; END IF;

  IF NOT (v_canonical_status = ANY(v_allowed)) AND v_current_status != v_canonical_status THEN
    RETURN jsonb_build_object(
      'error', 'invalid_transition',
      'current_status', v_current_status,
      'requested_status', v_canonical_status,
      'allowed', to_jsonb(v_allowed)
    );
  END IF;

  -- 5. Fetch latest version details BEFORE update for snapshots
  SELECT id, valor_total, potencia_kwp, snapshot 
    INTO v_latest_versao
    FROM proposta_versoes
   WHERE proposta_id = p_proposta_id
   ORDER BY versao_numero DESC
   LIMIT 1;

  -- 6. Update propostas_nativas
  UPDATE propostas_nativas
     SET status = v_canonical_status,
         updated_at = now(),
         is_principal = CASE WHEN v_canonical_status = 'accepted' THEN true ELSE is_principal END,
         aceita_at = CASE WHEN v_canonical_status = 'accepted' THEN now() ELSE aceita_at END,
         aceite_motivo = CASE WHEN v_canonical_status = 'accepted' THEN p_motivo ELSE aceite_motivo END,
         recusada_at = CASE WHEN v_canonical_status = 'rejected' THEN now() ELSE recusada_at END,
         recusa_motivo = CASE WHEN v_canonical_status = 'rejected' THEN p_motivo ELSE recusa_motivo END,
         enviada_at = CASE WHEN v_canonical_status = 'sent' AND enviada_at IS NULL THEN now() ELSE enviada_at END
   WHERE id = p_proposta_id
     AND tenant_id = v_tenant_id;

  -- 7. Sync proposal_versoes
  IF v_latest_versao.id IS NOT NULL THEN
    UPDATE proposta_versoes
       SET status = v_canonical_status,
           updated_at = now()
     WHERE id = v_latest_versao.id;
  END IF;

  -- 8. Atomic Side Effects on Acceptance
  IF v_canonical_status = 'accepted' THEN
    -- 8a. Update Deal to won and sync value
    IF v_deal_id IS NOT NULL THEN
      UPDATE deals 
         SET status = 'won', 
             value = COALESCE(v_latest_versao.valor_total, value),
             updated_at = now()
       WHERE id = v_deal_id;
    ELSIF v_projeto_id IS NOT NULL THEN
      UPDATE deals 
         SET status = 'won',
             value = COALESCE(v_latest_versao.valor_total, value),
             updated_at = now()
       WHERE projeto_id = v_projeto_id;
    END IF;

    -- 8b. Sync Projeto value and KWp (FINANCIAL SNAPSHOT)
    IF v_projeto_id IS NOT NULL THEN
      UPDATE projetos
         SET valor_total = COALESCE(v_latest_versao.valor_total, valor_total),
             potencia_kwp = COALESCE(v_latest_versao.potencia_kwp, potencia_kwp),
             snapshot_financeiro = v_latest_versao.snapshot,
             updated_at = now()
       WHERE id = v_projeto_id;
    END IF;

    -- 8c. Reject sibling proposals
    UPDATE propostas_nativas
       SET status = 'rejected',
           recusada_at = now(),
           recusa_motivo = 'Outra proposta do projeto foi aceita',
           is_principal = false
     WHERE projeto_id = v_projeto_id
       AND id != p_proposta_id
       AND status IN ('draft', 'generated', 'sent', 'viewed');
  END IF;

  -- 9. Side effects when REVERTING from accepted
  IF v_current_status = 'accepted' AND v_canonical_status != 'accepted' THEN
     IF v_deal_id IS NOT NULL THEN
       UPDATE deals SET status = 'open' WHERE id = v_deal_id AND status = 'won';
     ELSIF v_projeto_id IS NOT NULL THEN
       UPDATE deals SET status = 'open' WHERE projeto_id = v_projeto_id AND status = 'won';
     END IF;
     
     UPDATE propostas_nativas SET is_principal = false WHERE id = p_proposta_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'previous_status', v_current_status,
    'new_status', v_canonical_status
  );
END;
$$;