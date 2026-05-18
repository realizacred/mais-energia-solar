-- 1. Atualizar a função de gatilho para proposta_versoes (labels em inglês)
CREATE OR REPLACE FUNCTION public.validate_proposta_status_transition()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Se o status não mudou, permitir
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Transições permitidas em proposta_versoes (English labels)
  IF OLD.status = 'draft' AND NEW.status NOT IN ('generated', 'cancelled') THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: draft só pode ir para generated ou cancelled (tentou: %)', NEW.status
      USING ERRCODE = 'P0461';
  END IF;

  IF OLD.status = 'generated' AND NEW.status NOT IN ('sent', 'accepted', 'rejected', 'draft', 'cancelled') THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: generated só pode ir para sent, accepted, rejected, draft ou cancelled (tentou: %)', NEW.status
      USING ERRCODE = 'P0461';
  END IF;

  IF OLD.status = 'sent' AND NEW.status NOT IN ('viewed', 'accepted', 'rejected', 'expired', 'cancelled', 'generated') THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: sent só pode ir para viewed, accepted, rejected, expired, cancelled ou gerada (tentou: %)', NEW.status
      USING ERRCODE = 'P0461';
  END IF;

  IF OLD.status = 'viewed' AND NEW.status NOT IN ('accepted', 'rejected', 'expired', 'cancelled', 'generated') THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: viewed só pode ir para accepted, rejected, expired, cancelled ou gerada (tentou: %)', NEW.status
      USING ERRCODE = 'P0461';
  END IF;

  IF OLD.status = 'accepted' AND NEW.status NOT IN ('rejected', 'cancelled', 'generated') THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: accepted só pode ir para rejected, cancelled ou generated (tentou: %)', NEW.status
      USING ERRCODE = 'P0461';
  END IF;

  IF OLD.status = 'rejected' AND NEW.status NOT IN ('draft', 'generated') THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: rejected só pode ir para draft ou generated (tentou: %)', NEW.status
      USING ERRCODE = 'P0461';
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. Atualizar o RPC proposal_update_status (labels em português + side effects)
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
  v_latest_versao_id uuid;
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

  -- State machine (Portuguese labels)
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

  -- 1. Update propostas_nativas
  UPDATE propostas_nativas
     SET status = p_new_status,
         updated_at = now(),
         -- Side effect: mark as main if accepted
         is_principal = CASE WHEN p_new_status = 'aceita' THEN true ELSE is_principal END,
         aceita_at = CASE WHEN p_new_status = 'aceita' THEN now() ELSE aceita_at END,
         aceite_motivo = CASE WHEN p_new_status = 'aceita' THEN p_motivo ELSE aceite_motivo END,
         recusada_at = CASE WHEN p_new_status = 'recusada' THEN now() ELSE recusada_at END,
         recusa_motivo = CASE WHEN p_new_status = 'recusada' THEN p_motivo ELSE recusa_motivo END
   WHERE id = p_proposta_id
     AND tenant_id = v_tenant_id;

  -- 2. Sync proposal_versoes (English labels)
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

  SELECT id INTO v_latest_versao_id
    FROM proposta_versoes
   WHERE proposta_id = p_proposta_id
   ORDER BY versao_numero DESC
   LIMIT 1;

  IF v_latest_versao_id IS NOT NULL THEN
    UPDATE proposta_versoes
       SET status = v_versao_status,
           updated_at = now()
     WHERE id = v_latest_versao_id;
  END IF;

  -- 3. Side effects on acceptance
  IF p_new_status = 'aceita' THEN
    -- 3a. Update Deal to won
    IF v_deal_id IS NOT NULL THEN
      UPDATE deals SET status = 'won' WHERE id = v_deal_id AND status != 'won';
    ELSIF v_projeto_id IS NOT NULL THEN
      -- Try via projeto_id
      UPDATE deals SET status = 'won' WHERE projeto_id = v_projeto_id AND status != 'won';
    END IF;

    -- 3b. Unset is_principal and reject siblings
    IF v_projeto_id IS NOT NULL THEN
      UPDATE propostas_nativas
         SET is_principal = false
       WHERE projeto_id = v_projeto_id
         AND id != p_proposta_id;

      UPDATE propostas_nativas
         SET status = 'recusada',
             recusa_motivo = 'Outra proposta do projeto foi aceita'
       WHERE projeto_id = v_projeto_id
         AND id != p_proposta_id
         AND status IN ('rascunho', 'gerada', 'enviada', 'vista');
    END IF;
  END IF;

  -- 4. Event log
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
