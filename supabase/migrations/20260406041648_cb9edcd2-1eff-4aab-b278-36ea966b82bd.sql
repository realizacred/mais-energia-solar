-- Fix proposal_create: propostas_nativas.status deve usar 'rascunho' (text), não 'draft'::enum
CREATE OR REPLACE FUNCTION public.proposal_create(
  p_titulo text DEFAULT NULL::text,
  p_deal_id uuid DEFAULT NULL::uuid,
  p_lead_id uuid DEFAULT NULL::uuid,
  p_cliente_id uuid DEFAULT NULL::uuid,
  p_consultor_id uuid DEFAULT NULL::uuid,
  p_template_id uuid DEFAULT NULL::uuid,
  p_projeto_id uuid DEFAULT NULL::uuid,
  p_snapshot jsonb DEFAULT '{}'::jsonb,
  p_potencia_kwp numeric DEFAULT NULL::numeric,
  p_valor_total numeric DEFAULT NULL::numeric,
  p_economia_mensal numeric DEFAULT NULL::numeric,
  p_geracao_mensal numeric DEFAULT NULL::numeric,
  p_payback_meses numeric DEFAULT NULL::numeric,
  p_intent text DEFAULT 'draft'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id UUID;
  v_user_id UUID;
  v_proposta_id UUID;
  v_versao_id UUID;
  v_resolved_projeto_id UUID;
  v_snapshot jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  v_snapshot := public.normalize_proposta_snapshot(p_snapshot);
  v_tenant_id := current_tenant_id();
  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_tenant');
  END IF;

  v_resolved_projeto_id := p_projeto_id;

  IF v_resolved_projeto_id IS NULL AND p_deal_id IS NOT NULL THEN
    SELECT id INTO v_resolved_projeto_id
      FROM projetos
     WHERE deal_id = p_deal_id
       AND tenant_id = v_tenant_id
     LIMIT 1;
  END IF;

  IF v_resolved_projeto_id IS NULL THEN
    RETURN jsonb_build_object('error', 'projeto_id_required');
  END IF;

  INSERT INTO propostas_nativas (
    tenant_id, titulo, deal_id, lead_id, cliente_id, consultor_id,
    template_id, projeto_id, status, created_by, versao_atual
  ) VALUES (
    v_tenant_id,
    coalesce(p_titulo, 'Proposta sem título'),
    p_deal_id,
    p_lead_id,
    p_cliente_id,
    p_consultor_id,
    p_template_id,
    v_resolved_projeto_id,
    'rascunho',
    v_user_id,
    1
  )
  RETURNING id INTO v_proposta_id;

  INSERT INTO proposta_versoes (
    proposta_id, tenant_id, versao_numero, snapshot,
    potencia_kwp, valor_total, economia_mensal, geracao_mensal,
    payback_meses, status, created_at, updated_at
  ) VALUES (
    v_proposta_id, v_tenant_id, 1, v_snapshot,
    p_potencia_kwp, p_valor_total, p_economia_mensal, p_geracao_mensal,
    p_payback_meses, 'draft'::proposta_nativa_status, now(), now()
  )
  RETURNING id INTO v_versao_id;

  BEGIN
    INSERT INTO proposal_events (proposta_id, tenant_id, tipo, payload)
    VALUES (v_proposta_id, v_tenant_id, 'created', jsonb_build_object(
      'versao_id', v_versao_id,
      'created_by', v_user_id,
      'intent', p_intent
    ));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'proposta_id', v_proposta_id,
    'versao_id', v_versao_id,
    'versao_numero', 1
  );
END;
$function$;

-- Fix proposal_create_version: propostas_nativas.status = 'gerada' (text sem cast)
CREATE OR REPLACE FUNCTION public.proposal_create_version(
  p_proposta_id uuid,
  p_versao_id uuid DEFAULT NULL::uuid,
  p_snapshot jsonb DEFAULT NULL::jsonb,
  p_potencia_kwp numeric DEFAULT 0,
  p_valor_total numeric DEFAULT 0,
  p_economia_mensal numeric DEFAULT NULL::numeric,
  p_geracao_mensal numeric DEFAULT NULL::numeric,
  p_grupo text DEFAULT NULL::text,
  p_intent text DEFAULT 'draft'::text,
  p_idempotency_key text DEFAULT NULL::text,
  p_calc_hash text DEFAULT NULL::text,
  p_engine_version text DEFAULT NULL::text,
  p_validade_dias integer DEFAULT 30,
  p_observacoes text DEFAULT NULL::text,
  p_gerado_por uuid DEFAULT NULL::uuid,
  p_payback_meses numeric DEFAULT NULL::numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
  v_snapshot jsonb;
BEGIN
  IF p_proposta_id IS NULL THEN
    RETURN jsonb_build_object('error', 'proposta_id_required');
  END IF;
  IF p_snapshot IS NULL OR p_snapshot = 'null'::jsonb THEN
    RETURN jsonb_build_object('error', 'snapshot_required');
  END IF;

  v_snapshot := public.normalize_proposta_snapshot(p_snapshot);
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
      payback_meses, usuario_editou_em
    ) VALUES (
      p_proposta_id, v_tenant_id, v_next_numero, p_potencia_kwp, p_valor_total,
      p_economia_mensal, p_geracao_mensal, v_grupo_normalized, v_snapshot,
      v_set_active,
      CASE WHEN v_set_active THEN 'generated'::proposta_nativa_status ELSE 'draft'::proposta_nativa_status END,
      v_now, v_now,
      CASE WHEN v_set_active THEN v_now ELSE NULL END,
      p_idempotency_key, p_calc_hash, p_engine_version,
      p_validade_dias, v_valido_ate, p_observacoes, p_gerado_por,
      p_payback_meses, v_now
    )
    RETURNING id INTO v_new_versao_id;

    UPDATE proposta_aceite_tokens
    SET invalidado_em = v_now,
        motivo_invalidacao = 'nova_versao_criada'
    WHERE proposta_id = p_proposta_id
      AND invalidado_em IS NULL
      AND used_at IS NULL;
    GET DIAGNOSTICS v_invalidated_count = ROW_COUNT;

    IF p_versao_id IS NOT NULL THEN
      UPDATE proposta_versoes
      SET substituida_em = v_now,
          substituida_por = v_new_versao_id
      WHERE id = p_versao_id
        AND substituida_em IS NULL;
    END IF;

    IF v_set_active THEN
      UPDATE propostas_nativas
      SET versao_atual = v_next_numero,
          status = 'gerada',
          valid_until = v_valido_ate,
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
      UPDATE proposta_aceite_tokens
      SET invalidado_em = v_now,
          motivo_invalidacao = 'nova_versao_criada'
      WHERE proposta_id = p_proposta_id
        AND invalidado_em IS NULL
        AND used_at IS NULL;
      GET DIAGNOSTICS v_invalidated_count = ROW_COUNT;

      UPDATE propostas_nativas
      SET status = 'gerada',
          valid_until = v_valido_ate,
          updated_at = v_now
      WHERE id = p_proposta_id;
    ELSE
      v_invalidated_count := 0;
    END IF;

    RETURN jsonb_build_object(
      'success', TRUE,
      'proposta_id', p_proposta_id,
      'versao_id', p_versao_id,
      'versao_numero', v_versao_numero,
      'new_version_created', FALSE,
      'branch_reason', 'updated_in_place',
      'invalidated_tokens', v_invalidated_count
    );
  END IF;
END;
$function$;