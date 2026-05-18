-- Fase 1 Lote 2: normaliza PT→EN dentro do RPC para unificar caminhos
-- (edge proposal-transition continua sendo o wrapper canônico; este patch
-- apenas torna o RPC seguro quando chamado diretamente).
CREATE OR REPLACE FUNCTION public.proposal_update_status(
  p_proposta_id uuid,
  p_new_status text,
  p_motivo text DEFAULT NULL::text
)
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
  v_normalized text;
BEGIN
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

  SELECT status, deal_id, projeto_id INTO v_old_status, v_deal_id, v_projeto_id
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

  UPDATE propostas_nativas
  SET status = v_canonical_status,
      aceita_at = CASE WHEN v_canonical_status = 'accepted' THEN now() ELSE aceita_at END,
      updated_at = now()
  WHERE id = p_proposta_id;

  UPDATE proposta_versoes
  SET status = v_canonical_status,
      updated_at = now()
  WHERE proposta_id = p_proposta_id;

  IF v_canonical_status = 'accepted' THEN
    IF v_deal_id IS NOT NULL THEN
      UPDATE deals SET status = 'won', updated_at = now() WHERE id = v_deal_id;
    END IF;

    IF v_projeto_id IS NOT NULL AND v_latest_versao.valor_total IS NOT NULL THEN
      UPDATE projetos SET valor_total = v_latest_versao.valor_total, updated_at = now()
       WHERE id = v_projeto_id;
    END IF;

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

  INSERT INTO proposal_status_history (proposal_id, old_status, new_status, reason, created_by)
  VALUES (p_proposta_id, v_old_status, v_canonical_status, p_motivo, auth.uid());

  RETURN jsonb_build_object('success', true);
END;
$function$;