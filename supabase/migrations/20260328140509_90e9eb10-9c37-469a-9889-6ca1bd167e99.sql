-- Part 1: Add invalidation columns to proposta_aceite_tokens
ALTER TABLE public.proposta_aceite_tokens
  ADD COLUMN IF NOT EXISTS invalidado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS motivo_invalidacao TEXT;

-- Part 5: Add substituida tracking to proposta_versoes  
ALTER TABLE public.proposta_versoes
  ADD COLUMN IF NOT EXISTS substituida_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS substituida_por UUID REFERENCES proposta_versoes(id);

-- Index for quick lookup of active (non-invalidated) tokens
CREATE INDEX IF NOT EXISTS idx_proposta_aceite_tokens_invalidado
  ON public.proposta_aceite_tokens(proposta_id)
  WHERE invalidado_em IS NULL;

-- Update proposal_create_version to invalidate old tokens + mark old version as replaced
DROP FUNCTION IF EXISTS public.proposal_create_version(
  UUID, UUID, JSONB, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, INT, TEXT, UUID, NUMERIC
);

CREATE OR REPLACE FUNCTION public.proposal_create_version(
  p_proposta_id UUID,
  p_versao_id UUID DEFAULT NULL,
  p_snapshot JSONB DEFAULT NULL,
  p_potencia_kwp NUMERIC DEFAULT NULL,
  p_valor_total NUMERIC DEFAULT NULL,
  p_economia_mensal NUMERIC DEFAULT NULL,
  p_geracao_mensal NUMERIC DEFAULT NULL,
  p_grupo TEXT DEFAULT NULL,
  p_intent TEXT DEFAULT 'draft',
  p_idempotency_key TEXT DEFAULT NULL,
  p_calc_hash TEXT DEFAULT NULL,
  p_engine_version TEXT DEFAULT NULL,
  p_validade_dias INT DEFAULT 30,
  p_observacoes TEXT DEFAULT NULL,
  p_gerado_por UUID DEFAULT NULL,
  p_payback_meses NUMERIC DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_snapshot_locked BOOLEAN;
  v_versao_numero INT;
  v_version_status TEXT;
  v_proposta_status TEXT;
  v_needs_branch BOOLEAN := FALSE;
  v_branch_reason TEXT := 'none';
  v_new_versao_id UUID;
  v_set_active BOOLEAN;
  v_now TIMESTAMPTZ := now();
  v_grupo_normalized TEXT;
  v_next_numero INT;
  v_valido_ate DATE;
  v_invalidated_count INT;
BEGIN
  IF p_proposta_id IS NULL THEN
    RETURN jsonb_build_object('error', 'proposta_id_required');
  END IF;
  IF p_snapshot IS NULL OR p_snapshot = 'null'::jsonb THEN
    RETURN jsonb_build_object('error', 'snapshot_required');
  END IF;

  v_set_active := (p_intent = 'active');
  v_valido_ate := (v_now + (p_validade_dias || ' days')::interval)::date;

  IF p_grupo IS NOT NULL THEN
    IF p_grupo LIKE 'A%' THEN v_grupo_normalized := 'A';
    ELSIF p_grupo LIKE 'B%' THEN v_grupo_normalized := 'B';
    ELSE v_grupo_normalized := NULL;
    END IF;
  END IF;

  SELECT status, tenant_id INTO v_proposta_status, v_tenant_id
    FROM propostas_nativas
   WHERE id = p_proposta_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'proposta_not_found');
  END IF;

  IF p_versao_id IS NULL THEN
    v_needs_branch := TRUE;
    v_branch_reason := 'no_existing_version';
  ELSE
    SELECT snapshot_locked, versao_numero, status::text
      INTO v_snapshot_locked, v_versao_numero, v_version_status
      FROM proposta_versoes
     WHERE id = p_versao_id
     FOR UPDATE;

    IF NOT FOUND THEN
      v_needs_branch := TRUE;
      v_branch_reason := 'versao_not_found';
    ELSIF v_snapshot_locked THEN
      v_needs_branch := TRUE;
      v_branch_reason := 'snapshot_locked';
    ELSIF v_proposta_status IN ('enviada', 'vista', 'aceita', 'gerada') THEN
      v_needs_branch := TRUE;
      v_branch_reason := 'proposta_status_' || v_proposta_status;
    ELSIF v_version_status = 'generated' THEN
      v_needs_branch := TRUE;
      v_branch_reason := 'version_generated';
    END IF;
  END IF;

  IF v_needs_branch THEN
    SELECT COALESCE(MAX(versao_numero), 0) + 1 INTO v_next_numero
      FROM proposta_versoes
     WHERE proposta_id = p_proposta_id;

    INSERT INTO proposta_versoes (
      proposta_id, tenant_id, versao_numero, potencia_kwp, valor_total,
      economia_mensal, geracao_mensal, grupo, snapshot, snapshot_locked,
      status, created_at, updated_at, gerado_em,
      idempotency_key, calc_hash, engine_version,
      validade_dias, valido_ate, observacoes, gerado_por,
      payback_meses
    ) VALUES (
      p_proposta_id, v_tenant_id, v_next_numero, p_potencia_kwp, p_valor_total,
      p_economia_mensal, p_geracao_mensal, v_grupo_normalized, p_snapshot,
      v_set_active,
      CASE WHEN v_set_active THEN 'generated'::proposta_nativa_status ELSE 'draft'::proposta_nativa_status END,
      v_now, v_now,
      CASE WHEN v_set_active THEN v_now ELSE NULL END,
      p_idempotency_key, p_calc_hash, p_engine_version,
      p_validade_dias, v_valido_ate, p_observacoes, p_gerado_por,
      p_payback_meses
    )
    RETURNING id INTO v_new_versao_id;

    -- ═══ INVALIDATE old tokens (only unused ones) ═══
    UPDATE proposta_aceite_tokens
    SET invalidado_em = v_now,
        motivo_invalidacao = 'nova_versao_criada'
    WHERE proposta_id = p_proposta_id
      AND invalidado_em IS NULL
      AND used_at IS NULL;
    GET DIAGNOSTICS v_invalidated_count = ROW_COUNT;

    -- ═══ MARK old version as replaced ═══
    IF p_versao_id IS NOT NULL THEN
      UPDATE proposta_versoes
      SET substituida_em = v_now,
          substituida_por = v_new_versao_id
      WHERE id = p_versao_id
        AND substituida_em IS NULL;
    END IF;

    BEGIN
      INSERT INTO proposal_events (proposta_id, tenant_id, tipo, payload)
      VALUES (
        p_proposta_id, v_tenant_id, 'version_created',
        jsonb_build_object(
          'versao_antiga_id', p_versao_id,
          'versao_nova_id', v_new_versao_id,
          'versao_numero', v_next_numero,
          'motivo', v_branch_reason,
          'intent', p_intent,
          'tokens_invalidados', v_invalidated_count
        )
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    RETURN jsonb_build_object(
      'versao_id', v_new_versao_id,
      'new_version_created', TRUE,
      'versao_numero', v_next_numero,
      'reason', v_branch_reason,
      'tokens_invalidados', v_invalidated_count
    );
  END IF;

  UPDATE proposta_versoes SET
    potencia_kwp = p_potencia_kwp,
    valor_total = p_valor_total,
    economia_mensal = p_economia_mensal,
    geracao_mensal = p_geracao_mensal,
    grupo = v_grupo_normalized,
    snapshot = p_snapshot,
    snapshot_locked = v_set_active,
    status = CASE WHEN v_set_active THEN 'generated'::proposta_nativa_status ELSE 'draft'::proposta_nativa_status END,
    gerado_em = CASE WHEN v_set_active THEN v_now ELSE gerado_em END,
    calc_hash = COALESCE(p_calc_hash, calc_hash),
    engine_version = COALESCE(p_engine_version, engine_version),
    idempotency_key = COALESCE(p_idempotency_key, idempotency_key),
    validade_dias = COALESCE(p_validade_dias, validade_dias),
    valido_ate = v_valido_ate,
    observacoes = COALESCE(p_observacoes, observacoes),
    gerado_por = COALESCE(p_gerado_por, gerado_por),
    payback_meses = COALESCE(p_payback_meses, payback_meses),
    finalized_at = NULL,
    updated_at = v_now
  WHERE id = p_versao_id;

  RETURN jsonb_build_object(
    'versao_id', p_versao_id,
    'new_version_created', FALSE,
    'versao_numero', v_versao_numero,
    'reason', 'updated_in_place'
  );
END;
$$;

COMMENT ON FUNCTION public.proposal_create_version IS 'Backend-driven versioning with token invalidation and version replacement tracking';