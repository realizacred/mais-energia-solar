-- 1) sync_deal_value_from_versao: só sincroniza quando a versão é "generated"
--    (intent='active'), evitando que rascunhos/preview alterem deals.value.
CREATE OR REPLACE FUNCTION public.sync_deal_value_from_versao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _deal_id UUID;
  _is_principal BOOLEAN;
  _reason TEXT;
BEGIN
  -- Só propaga se a versão é gerada (final), não em rascunho.
  IF NEW.status IS DISTINCT FROM 'generated'::proposta_nativa_status THEN
    RETURN NEW;
  END IF;

  SELECT pn.deal_id, pn.is_principal
    INTO _deal_id, _is_principal
    FROM propostas_nativas pn
   WHERE pn.id = NEW.proposta_id;

  IF _deal_id IS NOT NULL
     AND _is_principal = true
     AND NEW.valor_total IS NOT NULL
     AND NEW.valor_total > 0 THEN

    -- Reaproveita motivo se setado pelo RPC; senão usa default.
    _reason := COALESCE(
      NULLIF(current_setting('app.value_change_reason', true), ''),
      CASE
        WHEN TG_OP = 'INSERT' THEN 'proposta_gerada'
        ELSE 'proposta_regenerada'
      END
    );
    PERFORM set_config('app.value_change_reason', _reason, true);

    UPDATE deals
       SET value = NEW.valor_total,
           updated_at = now()
     WHERE id = _deal_id
       AND value IS DISTINCT FROM NEW.valor_total;
  END IF;

  RETURN NEW;
END;
$$;

-- 2) audit_deal_changes: anexa metadata.reason ao evento value_changed
CREATE OR REPLACE FUNCTION public.audit_deal_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pipeline_name text;
  v_from_stage    text;
  v_to_stage      text;
  v_reason        text;
BEGIN
  PERFORM set_config('app.audit_trigger_active', 'true', true);

  IF OLD.pipeline_id IS DISTINCT FROM NEW.pipeline_id THEN
    INSERT INTO project_events (tenant_id, deal_id, actor_user_id, event_type, from_value, to_value)
    VALUES (NEW.tenant_id, NEW.id, auth.uid(), 'pipeline_changed', OLD.pipeline_id::text, NEW.pipeline_id::text);
  END IF;

  IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
    SELECT name INTO v_pipeline_name FROM pipelines       WHERE id = NEW.pipeline_id;
    SELECT name INTO v_from_stage    FROM pipeline_stages WHERE id = OLD.stage_id;
    SELECT name INTO v_to_stage      FROM pipeline_stages WHERE id = NEW.stage_id;

    INSERT INTO project_events (
      tenant_id, deal_id, actor_user_id, event_type, from_value, to_value, metadata
    ) VALUES (
      NEW.tenant_id, NEW.id, auth.uid(), 'stage_changed',
      OLD.stage_id::text, NEW.stage_id::text,
      jsonb_build_object(
        'pipeline_id',   NEW.pipeline_id,
        'pipeline_name', v_pipeline_name,
        'from_stage',    v_from_stage,
        'to_stage',      v_to_stage,
        'source',        'deals'
      )
    );
  END IF;

  IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
    INSERT INTO project_events (tenant_id, deal_id, actor_user_id, event_type, from_value, to_value)
    VALUES (NEW.tenant_id, NEW.id, auth.uid(), 'consultant_changed', OLD.owner_id::text, NEW.owner_id::text);
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO project_events (tenant_id, deal_id, actor_user_id, event_type, from_value, to_value)
    VALUES (NEW.tenant_id, NEW.id, auth.uid(), 'status_changed', OLD.status, NEW.status);
  END IF;

  IF OLD.value IS DISTINCT FROM NEW.value THEN
    v_reason := NULLIF(current_setting('app.value_change_reason', true), '');
    INSERT INTO project_events (
      tenant_id, deal_id, actor_user_id, event_type,
      from_value, to_value, metadata
    ) VALUES (
      NEW.tenant_id, NEW.id, auth.uid(), 'value_changed',
      OLD.value::text, NEW.value::text,
      CASE
        WHEN v_reason IS NOT NULL
          THEN jsonb_build_object('reason', v_reason)
        ELSE jsonb_build_object('reason', 'manual_edit')
      END
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- 3) proposal_create_version: seta app.value_change_reason ANTES de gravar
--    quando intent='active' (gera/regenera). Em draft, deixa NULL e o trigger
--    sync_deal_value_from_versao já abortará, então nenhum evento é emitido.
CREATE OR REPLACE FUNCTION public.proposal_create_version(
  p_proposta_id uuid,
  p_versao_id uuid DEFAULT NULL::uuid,
  p_snapshot jsonb DEFAULT NULL::jsonb,
  p_potencia_kwp numeric DEFAULT NULL::numeric,
  p_valor_total numeric DEFAULT NULL::numeric,
  p_economia_mensal numeric DEFAULT NULL::numeric,
  p_geracao_mensal numeric DEFAULT NULL::numeric,
  p_grupo text DEFAULT NULL::text,
  p_idempotency_key text DEFAULT NULL::text,
  p_calc_hash text DEFAULT NULL::text,
  p_engine_version text DEFAULT NULL::text,
  p_validade_dias integer DEFAULT 30,
  p_observacoes text DEFAULT NULL::text,
  p_gerado_por uuid DEFAULT NULL::uuid,
  p_payback_meses integer DEFAULT NULL::integer,
  p_intent text DEFAULT 'draft'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  v_derived_payback INT;
  v_derived_consumo NUMERIC;
  v_derived_tarifa NUMERIC;
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

  v_derived_payback := COALESCE(
    p_payback_meses,
    NULLIF(v_snapshot->>'payback_meses','')::int
  );
  v_derived_consumo := NULLIF(v_snapshot->'ucs'->0->>'consumo_mensal_kwh','')::numeric;
  v_derived_tarifa := NULLIF(v_snapshot->'ucs'->0->>'tarifa_distribuidora','')::numeric;

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

  -- Define motivo da mudança de valor para os triggers downstream.
  -- Apenas quando intent='active' a propagação para deals.value acontece.
  IF v_set_active THEN
    PERFORM set_config(
      'app.value_change_reason',
      CASE
        WHEN v_needs_branch AND v_branch_reason LIKE 'proposta_status_%' THEN 'proposta_regenerada'
        WHEN v_needs_branch THEN 'proposta_gerada'
        ELSE 'proposta_ativa'
      END,
      true
    );
  ELSE
    PERFORM set_config('app.value_change_reason', '', true);
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
      payback_meses, usuario_editou_em,
      consumo_mensal, tarifa_distribuidora
    ) VALUES (
      p_proposta_id, v_tenant_id, v_next_numero, p_potencia_kwp, p_valor_total,
      p_economia_mensal, p_geracao_mensal, v_grupo_normalized, v_snapshot,
      v_set_active,
      CASE WHEN v_set_active THEN 'generated'::proposta_nativa_status ELSE 'draft'::proposta_nativa_status END,
      v_now, v_now,
      CASE WHEN v_set_active THEN v_now ELSE NULL END,
      p_idempotency_key, p_calc_hash, p_engine_version,
      p_validade_dias, v_valido_ate, p_observacoes, p_gerado_por,
      v_derived_payback, v_now,
      v_derived_consumo, v_derived_tarifa
    )
    RETURNING id INTO v_new_versao_id;

    UPDATE proposta_aceite_tokens
    SET invalidado_em = v_now,
        motivo_invalidacao = 'nova_versao_criada'
    WHERE proposta_id = p_proposta_id
      AND versao_id <> v_new_versao_id
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
        payback_meses = COALESCE(v_derived_payback, payback_meses),
        consumo_mensal = COALESCE(v_derived_consumo, consumo_mensal),
        tarifa_distribuidora = COALESCE(v_derived_tarifa, tarifa_distribuidora),
        usuario_editou_em = v_now,
        updated_at = v_now
    WHERE id = p_versao_id;

    IF v_set_active THEN
      UPDATE proposta_aceite_tokens
      SET invalidado_em = v_now,
          motivo_invalidacao = 'nova_versao_criada'
      WHERE proposta_id = p_proposta_id
        AND versao_id <> p_versao_id
        AND invalidado_em IS NULL
        AND used_at IS NULL;
      GET DIAGNOSTICS v_invalidated_count = ROW_COUNT;

      UPDATE propostas_nativas
      SET status = 'gerada',
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