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
  v_tenant_id uuid;
  v_latest_versao record;
  v_normalized text;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();

  -- Normalize PT-BR aliases to canonical EN (drop-in compat with edge)
  v_normalized := CASE lower(coalesce(p_new_status, ''))
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

  BEGIN
    v_canonical_status := v_normalized::proposta_nativa_status;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Status inválido: ' || p_new_status);
  END;

  SELECT status, deal_id, projeto_id, tenant_id INTO v_old_status, v_deal_id, v_projeto_id, v_tenant_id
  FROM propostas_nativas
  WHERE id = p_proposta_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Proposta não encontrada');
  END IF;

  SELECT id, valor_total INTO v_latest_versao
  FROM proposta_versoes
  WHERE proposta_id = p_proposta_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- Update Proposal state
  UPDATE propostas_nativas
  SET status = v_canonical_status,
      aceita_at = CASE 
        WHEN v_canonical_status = 'accepted' THEN now() 
        WHEN v_old_status = 'accepted' AND v_canonical_status <> 'accepted' THEN NULL -- Limpa ao reverter
        ELSE aceita_at 
      END,
      updated_at = now()
  WHERE id = p_proposta_id;

  UPDATE proposta_versoes
  SET status = v_canonical_status,
      updated_at = now()
  WHERE proposta_id = p_proposta_id;

  -- Registrar evento unificado (SSOT para timeline e auditoria)
  -- Formato solicitado: previous_status, new_status, reason, source
  INSERT INTO public.proposal_events (proposta_id, tenant_id, user_id, tipo, payload)
  VALUES (p_proposta_id, v_tenant_id, v_user_id, 'status_change', jsonb_build_object(
    'previous_status', v_old_status::text,
    'new_status', v_canonical_status::text,
    'reason', p_motivo,
    'source', 'proposal_update_status'
  ));

  -- Side effects on accept (APENAS se houver aceita_at, o que agora é garantido pelo UPDATE acima)
  IF v_canonical_status = 'accepted' THEN
    -- Side effects como Reject siblings agora são disparados via trigger ou mantidos aqui
    -- Mas a promoção de Deal é controlada pela trigger sync_deal_status_on_proposal_acceptance
    
    IF v_projeto_id IS NOT NULL AND v_latest_versao.valor_total IS NOT NULL THEN
      UPDATE projetos SET valor_total = v_latest_versao.valor_total, updated_at = now()
       WHERE id = v_projeto_id;
    END IF;

    -- Reject siblings on acceptance
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

  RETURN jsonb_build_object('success', true);
END;
$function$;