
CREATE OR REPLACE FUNCTION public.proposal_create_version(
  p_proposta_id UUID,
  p_versao_id UUID,
  p_snapshot JSONB,
  p_potencia_kwp NUMERIC DEFAULT 0,
  p_valor_total NUMERIC DEFAULT 0,
  p_economia_mensal NUMERIC DEFAULT NULL,
  p_geracao_mensal NUMERIC DEFAULT NULL,
  p_grupo TEXT DEFAULT NULL,
  p_intent TEXT DEFAULT 'draft'
)
RETURNS JSONB
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
BEGIN
  -- Input validation
  IF p_proposta_id IS NULL THEN
    RETURN jsonb_build_object('error', 'proposta_id_required');
  END IF;
  IF p_versao_id IS NULL THEN
    RETURN jsonb_build_object('error', 'versao_id_required');
  END IF;
  IF p_snapshot IS NULL OR p_snapshot = 'null'::jsonb THEN
    RETURN jsonb_build_object('error', 'snapshot_required');
  END IF;

  v_set_active := (p_intent = 'active');

  -- Normalize grupo
  IF p_grupo IS NOT NULL THEN
    IF p_grupo LIKE 'A%' THEN v_grupo_normalized := 'A';
    ELSIF p_grupo LIKE 'B%' THEN v_grupo_normalized := 'B';
    ELSE v_grupo_normalized := NULL;
    END IF;
  END IF;

  -- 1. Lock proposta row to prevent concurrent modifications
  SELECT status, tenant_id INTO v_proposta_status, v_tenant_id
    FROM propostas_nativas
   WHERE id = p_proposta_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'proposta_not_found');
  END IF;

  -- 2. Fetch current version info
  SELECT snapshot_locked, versao_numero, status
    INTO v_snapshot_locked, v_versao_numero, v_version_status
    FROM proposta_versoes
   WHERE id = p_versao_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'versao_not_found');
  END IF;

  -- 3. Decide branching
  IF v_snapshot_locked THEN
    v_needs_branch := TRUE;
    v_branch_reason := 'snapshot_locked';
  ELSIF v_proposta_status IN ('enviada', 'vista', 'aceita', 'gerada') THEN
    v_needs_branch := TRUE;
    v_branch_reason := 'proposta_status_' || v_proposta_status;
  ELSIF v_version_status = 'generated' THEN
    v_needs_branch := TRUE;
    v_branch_reason := 'version_generated';
  END IF;

  -- 4a. BRANCH: create new version
  IF v_needs_branch THEN
    -- Safe next numero with lock (prevents duplicates under concurrency)
    SELECT COALESCE(MAX(versao_numero), 0) + 1 INTO v_next_numero
      FROM proposta_versoes
     WHERE proposta_id = p_proposta_id;

    INSERT INTO proposta_versoes (
      proposta_id, tenant_id, versao_numero, potencia_kwp, valor_total,
      economia_mensal, geracao_mensal, grupo, snapshot, snapshot_locked,
      status, created_at, updated_at, gerado_em
    ) VALUES (
      p_proposta_id, v_tenant_id, v_next_numero, p_potencia_kwp, p_valor_total,
      p_economia_mensal, p_geracao_mensal, v_grupo_normalized, p_snapshot,
      v_set_active,
      CASE WHEN v_set_active THEN 'generated' ELSE 'draft' END,
      v_now, v_now,
      CASE WHEN v_set_active THEN v_now ELSE NULL END
    )
    RETURNING id INTO v_new_versao_id;

    -- Log event (non-blocking)
    BEGIN
      INSERT INTO proposal_events (proposta_id, tenant_id, tipo, payload)
      VALUES (
        p_proposta_id, v_tenant_id, 'version_created',
        jsonb_build_object(
          'versao_antiga_id', p_versao_id,
          'versao_nova_id', v_new_versao_id,
          'versao_numero', v_next_numero,
          'motivo', v_branch_reason,
          'intent', p_intent
        )
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    RETURN jsonb_build_object(
      'versao_id', v_new_versao_id,
      'new_version_created', TRUE,
      'versao_numero', v_next_numero,
      'reason', v_branch_reason
    );
  END IF;

  -- 4b. UPDATE in place (version already locked by FOR UPDATE above)
  UPDATE proposta_versoes SET
    potencia_kwp = p_potencia_kwp,
    valor_total = p_valor_total,
    economia_mensal = p_economia_mensal,
    geracao_mensal = p_geracao_mensal,
    grupo = v_grupo_normalized,
    snapshot = p_snapshot,
    snapshot_locked = v_set_active,
    status = CASE WHEN v_set_active THEN 'generated' ELSE 'draft' END,
    gerado_em = CASE WHEN v_set_active THEN v_now ELSE gerado_em END,
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
