-- Fix: proposal_create_version references non-existent column valid_until on propostas_nativas
-- propostas_nativas does NOT have valid_until or valido_ate — only proposta_versoes has valido_ate
-- Remove the invalid column reference from both UPDATE statements on propostas_nativas

CREATE OR REPLACE FUNCTION public.proposal_create_version(
  p_proposta_id UUID,
  p_versao_id UUID DEFAULT NULL,
  p_snapshot JSONB DEFAULT '{}'::jsonb,
  p_potencia_kwp NUMERIC DEFAULT 0,
  p_valor_total NUMERIC DEFAULT 0,
  p_economia_mensal NUMERIC DEFAULT 0,
  p_geracao_mensal NUMERIC DEFAULT 0,
  p_grupo TEXT DEFAULT 'A',
  p_set_active BOOLEAN DEFAULT FALSE,
  p_idempotency_key TEXT DEFAULT NULL,
  p_calc_hash TEXT DEFAULT NULL,
  p_engine_version TEXT DEFAULT NULL,
  p_validade_dias INT DEFAULT 15,
  p_observacoes TEXT DEFAULT NULL,
  p_gerado_por UUID DEFAULT NULL,
  p_payback_meses NUMERIC DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposta RECORD;
  v_versao RECORD;
  v_new_versao_id UUID;
  v_next_numero INT;
  v_now TIMESTAMPTZ := now();
  v_branch_reason TEXT := NULL;
  v_invalidated_count INT := 0;
  v_set_active BOOLEAN := COALESCE(p_set_active, FALSE);
  v_grupo_normalized TEXT;
  v_snapshot JSONB;
  v_valido_ate DATE;
BEGIN
  SELECT * INTO v_proposta FROM propostas_nativas WHERE id = p_proposta_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'proposta_not_found');
  END IF;

  v_valido_ate := (v_now + (p_validade_dias || ' days')::interval)::date;

  v_grupo_normalized := UPPER(TRIM(COALESCE(p_grupo, 'A')));
  IF v_grupo_normalized NOT IN ('A', 'B') THEN
    v_grupo_normalized := 'A';
  END IF;

  -- Merge customFieldValues from _wizard_state to root
  v_snapshot := p_snapshot;
  IF v_snapshot ? '_wizard_state'
     AND (v_snapshot->'_wizard_state') ? 'customFieldValues'
     AND (NOT (v_snapshot ? 'customFieldValues') OR v_snapshot->'customFieldValues' IS NULL OR v_snapshot->>'customFieldValues' = 'null')
  THEN
    v_snapshot := jsonb_set(v_snapshot, '{customFieldValues}', v_snapshot->'_wizard_state'->'customFieldValues');
  END IF;

  IF p_versao_id IS NULL THEN
    v_next_numero := COALESCE(v_proposta.versao_atual, 0) + 1;
    v_branch_reason := 'new_from_scratch';

    v_new_versao_id := gen_random_uuid();
    INSERT INTO proposta_versoes (
      id, proposta_id, versao_numero, snapshot,
      potencia_kwp, valor_total, economia_mensal, geracao_mensal,
      grupo, snapshot_locked,
      status, gerado_em, idempotency_key, calc_hash, engine_version,
      validade_dias, valido_ate, observacoes, gerado_por,
      payback_meses, usuario_editou_em,
      created_at, updated_at
    ) VALUES (
      v_new_versao_id, p_proposta_id, v_next_numero, v_snapshot,
      p_potencia_kwp, p_valor_total, p_economia_mensal, p_geracao_mensal,
      v_grupo_normalized, v_set_active,
      CASE WHEN v_set_active THEN 'generated'::proposta_nativa_status ELSE 'draft'::proposta_nativa_status END,
      CASE WHEN v_set_active THEN v_now ELSE NULL END,
      p_idempotency_key, p_calc_hash, p_engine_version,
      p_validade_dias, v_valido_ate, p_observacoes, p_gerado_por,
      p_payback_meses, v_now,
      v_now, v_now
    );

    UPDATE proposta_aceite_tokens
    SET invalidado_em = v_now,
        motivo_invalidacao = 'nova_versao_criada'
    WHERE proposta_id = p_proposta_id
      AND invalidado_em IS NULL
      AND used_at IS NULL;
    GET DIAGNOSTICS v_invalidated_count = ROW_COUNT;

    IF v_set_active THEN
      UPDATE propostas_nativas
      SET versao_atual = v_next_numero,
          status = 'gerada',
          updated_at = v_now
      WHERE id = p_proposta_id;
    ELSE
      UPDATE propostas_nativas
      SET versao_atual = v_next_numero,
          updated_at = v_now
      WHERE id = p_proposta_id;
    END IF;

    RETURN jsonb_build_object(
      'success', TRUE,
      'proposta_id', p_proposta_id,
      'versao_id', v_new_versao_id,
      'versao_numero', v_next_numero,
      'new_version_created', TRUE,
      'branch_reason', v_branch_reason,
      'invalidated_tokens', v_invalidated_count
    );
  ELSE
    UPDATE proposta_versoes
    SET snapshot = v_snapshot,
        potencia_kwp = p_potencia_kwp,
        valor_total = p_valor_total,
        economia_mensal = p_economia_mensal,
        geracao_mensal = p_geracao_mensal,
        grupo = v_grupo_normalized,
        snapshot_locked = v_set_active,
        status = CASE WHEN v_set_active THEN 'generated'::proposta_nativa_status ELSE status END,
        gerado_em = CASE WHEN v_set_active THEN COALESCE(gerado_em, v_now) ELSE gerado_em END,
        idempotency_key = COALESCE(p_idempotency_key, idempotency_key),
        calc_hash = COALESCE(p_calc_hash, calc_hash),
        engine_version = COALESCE(p_engine_version, engine_version),
        validade_dias = CASE WHEN v_set_active THEN p_validade_dias ELSE validade_dias END,
        valido_ate = CASE WHEN v_set_active THEN v_valido_ate ELSE valido_ate END,
        observacoes = COALESCE(p_observacoes, observacoes),
        gerado_por = COALESCE(p_gerado_por, gerado_por),
        payback_meses = COALESCE(p_payback_meses, payback_meses),
        usuario_editou_em = v_now,
        updated_at = v_now
    WHERE id = p_versao_id;

    IF v_set_active THEN
      SELECT versao_numero INTO v_next_numero FROM proposta_versoes WHERE id = p_versao_id;

      UPDATE proposta_aceite_tokens
      SET invalidado_em = v_now,
          motivo_invalidacao = 'nova_versao_criada'
      WHERE proposta_id = p_proposta_id
        AND invalidado_em IS NULL
        AND used_at IS NULL;
      GET DIAGNOSTICS v_invalidated_count = ROW_COUNT;

      UPDATE propostas_nativas
      SET status = 'gerada',
          updated_at = v_now
      WHERE id = p_proposta_id;
    ELSE
      SELECT versao_numero INTO v_next_numero FROM proposta_versoes WHERE id = p_versao_id;
      v_invalidated_count := 0;
    END IF;

    RETURN jsonb_build_object(
      'success', TRUE,
      'proposta_id', p_proposta_id,
      'versao_id', p_versao_id,
      'versao_numero', v_next_numero,
      'new_version_created', FALSE,
      'branch_reason', NULL,
      'invalidated_tokens', v_invalidated_count
    );
  END IF;
END;
$$;