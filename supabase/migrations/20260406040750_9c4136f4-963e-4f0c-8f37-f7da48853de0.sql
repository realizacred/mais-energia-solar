CREATE OR REPLACE FUNCTION public.normalize_proposta_snapshot(p_snapshot jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_snapshot IS NULL OR p_snapshot = 'null'::jsonb THEN '{}'::jsonb
    ELSE jsonb_set(
      p_snapshot,
      '{customFieldValues}',
      COALESCE(p_snapshot->'_wizard_state'->'customFieldValues', '{}'::jsonb)
      || COALESCE(p_snapshot->'customFieldValues', '{}'::jsonb),
      true
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.create_proposta_nativa_atomic(
  p_titulo text,
  p_lead_id uuid DEFAULT NULL::uuid,
  p_projeto_id uuid DEFAULT NULL::uuid,
  p_deal_id uuid DEFAULT NULL::uuid,
  p_origem text DEFAULT 'native'::text,
  p_potencia_kwp numeric DEFAULT 0,
  p_valor_total numeric DEFAULT 0,
  p_snapshot jsonb DEFAULT '{}'::jsonb,
  p_cliente_nome text DEFAULT NULL::text,
  p_cliente_telefone text DEFAULT NULL::text,
  p_cliente_email text DEFAULT NULL::text,
  p_cliente_cpf_cnpj text DEFAULT NULL::text,
  p_cliente_empresa text DEFAULT NULL::text,
  p_cliente_cep text DEFAULT NULL::text,
  p_cliente_estado text DEFAULT NULL::text,
  p_cliente_cidade text DEFAULT NULL::text,
  p_cliente_rua text DEFAULT NULL::text,
  p_cliente_numero text DEFAULT NULL::text,
  p_cliente_bairro text DEFAULT NULL::text,
  p_cliente_complemento text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_proposta_id uuid;
  v_versao_id uuid;
  v_projeto_id uuid;
  v_deal_id uuid;
  v_cliente_id uuid;
  v_grupo text;
  v_geracao_mensal numeric;
  v_cliente_nome_final text;
  v_snapshot jsonb;
BEGIN
  v_snapshot := public.normalize_proposta_snapshot(p_snapshot);

  SELECT p.tenant_id INTO v_tenant_id
  FROM profiles p WHERE p.user_id = auth.uid();
  
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant não encontrado para o usuário atual';
  END IF;

  v_projeto_id := p_projeto_id;
  v_deal_id := p_deal_id;

  v_grupo := v_snapshot->>'grupo';
  IF v_grupo IS NOT NULL THEN
    v_grupo := CASE
      WHEN v_grupo LIKE 'A%' THEN 'A'
      WHEN v_grupo LIKE 'B%' THEN 'B'
      ELSE NULL
    END;
  END IF;

  v_geracao_mensal := (v_snapshot->>'geracaoMensalEstimada')::numeric;
  IF v_geracao_mensal IS NULL AND p_potencia_kwp > 0 THEN
    v_geracao_mensal := ROUND(p_potencia_kwp * COALESCE((v_snapshot->>'locIrradiacao')::numeric, 4.5) * 30 * 0.80);
  END IF;

  IF v_projeto_id IS NOT NULL THEN
    SELECT proj.cliente_id INTO v_cliente_id
    FROM projetos proj WHERE proj.id = v_projeto_id;
  END IF;

  IF v_cliente_id IS NULL THEN
    v_cliente_nome_final := COALESCE(NULLIF(btrim(p_cliente_nome), ''), 'Cliente Rascunho');
    
    v_cliente_id := public.get_or_create_cliente(
      p_nome := v_cliente_nome_final,
      p_telefone := COALESCE(NULLIF(btrim(p_cliente_telefone), ''), '00000000000'),
      p_email := p_cliente_email,
      p_cpf_cnpj := p_cliente_cpf_cnpj,
      p_empresa := p_cliente_empresa,
      p_cep := p_cliente_cep,
      p_estado := p_cliente_estado,
      p_cidade := p_cliente_cidade,
      p_rua := p_cliente_rua,
      p_numero := p_cliente_numero,
      p_bairro := p_cliente_bairro,
      p_complemento := p_cliente_complemento
    );
  END IF;

  IF v_projeto_id IS NULL THEN
    INSERT INTO projetos (tenant_id, lead_id, cliente_id, status, is_principal)
    VALUES (
      v_tenant_id, p_lead_id, v_cliente_id, 'criado',
      NOT EXISTS (SELECT 1 FROM projetos WHERE cliente_id = v_cliente_id AND is_principal = true)
    )
    RETURNING id INTO v_projeto_id;
  END IF;

  IF v_deal_id IS NULL AND v_projeto_id IS NOT NULL THEN
    SELECT d.id INTO v_deal_id
    FROM deals d WHERE d.projeto_id = v_projeto_id LIMIT 1;
  END IF;

  INSERT INTO propostas_nativas (
    tenant_id, titulo, lead_id, cliente_id, projeto_id, deal_id, origem, status
  ) VALUES (
    v_tenant_id, p_titulo, p_lead_id, v_cliente_id, v_projeto_id, v_deal_id, p_origem, 'rascunho'
  ) RETURNING id INTO v_proposta_id;

  INSERT INTO proposta_versoes (
    tenant_id, proposta_id, versao_numero, status,
    potencia_kwp, valor_total, grupo, geracao_mensal, economia_mensal, snapshot
  ) VALUES (
    v_tenant_id, v_proposta_id, 1, 'draft',
    p_potencia_kwp, p_valor_total, v_grupo, v_geracao_mensal, NULL, v_snapshot
  ) RETURNING id INTO v_versao_id;

  RETURN jsonb_build_object(
    'proposta_id', v_proposta_id,
    'versao_id', v_versao_id,
    'projeto_id', v_projeto_id,
    'deal_id', v_deal_id,
    'cliente_id', v_cliente_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_proposta_nativa_atomic_v2(
  p_titulo text,
  p_lead_id uuid,
  p_projeto_id uuid,
  p_deal_id uuid,
  p_origem text,
  p_potencia_kwp numeric,
  p_valor_total numeric,
  p_snapshot jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_tenant_id uuid;
  v_projeto_id uuid;
  v_cliente_id uuid;
  v_proposta_id uuid;
  v_versao_id uuid;
  v_snapshot jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  v_snapshot := public.normalize_proposta_snapshot(p_snapshot);
  v_tenant_id := require_tenant_id();

  IF p_projeto_id IS NOT NULL THEN
    SELECT id, cliente_id INTO v_projeto_id, v_cliente_id
    FROM projetos WHERE id = p_projeto_id AND tenant_id = v_tenant_id;
    IF v_projeto_id IS NULL THEN
      RAISE EXCEPTION 'projeto_id % não encontrado no tenant', p_projeto_id;
    END IF;
  END IF;

  IF v_projeto_id IS NULL AND p_deal_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM deals WHERE id = p_deal_id AND tenant_id = v_tenant_id) THEN
      RAISE EXCEPTION 'deal_id % não encontrado no tenant', p_deal_id;
    END IF;

    SELECT id, cliente_id INTO v_projeto_id, v_cliente_id
    FROM projetos WHERE deal_id = p_deal_id AND tenant_id = v_tenant_id
    LIMIT 1;
  END IF;

  IF v_cliente_id IS NULL AND p_deal_id IS NOT NULL THEN
    SELECT customer_id INTO v_cliente_id
    FROM deals WHERE id = p_deal_id AND tenant_id = v_tenant_id;
  END IF;

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Impossível criar proposta: cliente não encontrado (projeto_id=%, deal_id=%)', p_projeto_id, p_deal_id;
  END IF;

  IF v_projeto_id IS NULL THEN
    INSERT INTO projetos (tenant_id, cliente_id, lead_id, deal_id, created_by, status, potencia_kwp, observacoes)
    VALUES (v_tenant_id, v_cliente_id, p_lead_id, p_deal_id, v_user_id, 'aguardando_documentacao', p_potencia_kwp, 'Projeto criado automaticamente via proposta v2')
    RETURNING id INTO v_projeto_id;
  END IF;

  INSERT INTO propostas_nativas (tenant_id, titulo, cliente_id, lead_id, projeto_id, deal_id, status, origem, created_by)
  VALUES (v_tenant_id, COALESCE(NULLIF(p_titulo,''), 'Proposta sem título'), v_cliente_id, p_lead_id, v_projeto_id, p_deal_id, 'rascunho', p_origem, v_user_id)
  RETURNING id INTO v_proposta_id;

  INSERT INTO proposta_versoes (tenant_id, proposta_id, versao_numero, status, potencia_kwp, valor_total, snapshot)
  VALUES (v_tenant_id, v_proposta_id, 1, 'draft', p_potencia_kwp, p_valor_total, v_snapshot)
  RETURNING id INTO v_versao_id;

  RETURN jsonb_build_object('proposta_id', v_proposta_id, 'versao_id', v_versao_id, 'projeto_id', v_projeto_id);
END;
$function$;

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
    'draft'::proposta_nativa_status,
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
          status = 'gerada'::proposta_nativa_status,
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
      SET status = 'gerada'::proposta_nativa_status,
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