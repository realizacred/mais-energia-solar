CREATE OR REPLACE FUNCTION public.proposal_update_status(p_proposta_id uuid, p_new_status text, p_motivo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_old_status proposta_nativa_status;
  v_canonical_status proposta_nativa_status;
  v_deal_id uuid;
  v_projeto_id uuid;
  v_latest_versao record;
BEGIN
  -- Convert input text to enum and validate
  BEGIN
    v_canonical_status := p_new_status::proposta_nativa_status;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Status inválido: ' || p_new_status);
  END;

  SELECT status, deal_id, projeto_id INTO v_old_status, v_deal_id, v_projeto_id
  FROM propostas_nativas
  WHERE id = p_proposta_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Proposta não encontrada');
  END IF;

  -- Get latest version details for updates
  SELECT id, valor_total INTO v_latest_versao
  FROM proposta_versoes
  WHERE proposta_id = p_proposta_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- Update main proposal status
  UPDATE propostas_nativas
  SET status = v_canonical_status,
      updated_at = now()
  WHERE id = p_proposta_id;

  -- Update versions status
  UPDATE proposta_versoes
  SET status = v_canonical_status,
      updated_at = now()
  WHERE proposta_id = p_proposta_id;

  -- Side effects for accepted status
  IF v_canonical_status = 'accepted' THEN
    -- Update deal to won (NO CAST to deal_status)
    IF v_deal_id IS NOT NULL THEN
      UPDATE deals SET status = 'won', updated_at = now() WHERE id = v_deal_id;
    END IF;

    -- Update project value (FIXED COLUMN NAME: valor -> valor_total)
    IF v_projeto_id IS NOT NULL AND v_latest_versao.valor_total IS NOT NULL THEN
      UPDATE projetos SET valor_total = v_latest_versao.valor_total, updated_at = now() 
       WHERE id = v_projeto_id;
    END IF;

    -- Reject all other proposals for the same project
    IF v_projeto_id IS NOT NULL THEN
      UPDATE propostas_nativas
         SET status = 'rejected'::proposta_nativa_status,
             recusa_motivo = 'Outra proposta aceita para este projeto',
             updated_at = now()
       WHERE projeto_id = v_projeto_id
         AND id <> p_proposta_id
         AND status IN ('generated'::proposta_nativa_status, 'sent'::proposta_nativa_status);
         
      UPDATE proposta_versoes pv
         SET status = 'rejected'::proposta_nativa_status,
             updated_at = now()
        FROM propostas_nativas pn
       WHERE pv.proposta_id = pn.id
         AND pn.projeto_id = v_projeto_id
         AND pn.id <> p_proposta_id
         AND pn.status = 'rejected'::proposta_nativa_status;
    END IF;
  END IF;

  -- Log transition
  INSERT INTO proposal_status_history (proposal_id, old_status, new_status, reason, created_by)
  VALUES (p_proposta_id, v_old_status, v_canonical_status, p_motivo, auth.uid());

  RETURN jsonb_build_object('success', true);
END;
$function$;