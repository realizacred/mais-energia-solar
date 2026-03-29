-- Fix: replace 'rascunho' with 'draft' in both RPCs
-- The enum proposta_nativa_status uses 'draft', not 'rascunho'

-- 1. Fix proposal_create
CREATE OR REPLACE FUNCTION public.proposal_create(
  p_titulo TEXT DEFAULT NULL,
  p_deal_id UUID DEFAULT NULL,
  p_lead_id UUID DEFAULT NULL,
  p_cliente_id UUID DEFAULT NULL,
  p_consultor_id UUID DEFAULT NULL,
  p_template_id UUID DEFAULT NULL,
  p_projeto_id UUID DEFAULT NULL,
  p_snapshot JSONB DEFAULT '{}'::jsonb,
  p_potencia_kwp NUMERIC DEFAULT NULL,
  p_valor_total NUMERIC DEFAULT NULL,
  p_economia_mensal NUMERIC DEFAULT NULL,
  p_geracao_mensal NUMERIC DEFAULT NULL,
  p_payback_meses NUMERIC DEFAULT NULL,
  p_intent TEXT DEFAULT 'draft'
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_user_id UUID;
  v_proposta_id UUID;
  v_versao_id UUID;
  v_resolved_projeto_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

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
    v_proposta_id, v_tenant_id, 1, p_snapshot,
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
$$;

-- 2. Fix proposal_clone
CREATE OR REPLACE FUNCTION public.proposal_clone(
  p_source_proposta_id UUID,
  p_titulo TEXT DEFAULT NULL,
  p_target_deal_id UUID DEFAULT NULL,
  p_target_cliente_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_user_id UUID;
  v_source RECORD;
  v_source_versao RECORD;
  v_new_proposta_id UUID;
  v_new_versao_id UUID;
  v_resolved_projeto_id UUID;
  v_resolved_deal_id UUID;
  v_resolved_cliente_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  v_tenant_id := current_tenant_id();
  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_tenant');
  END IF;

  SELECT id, titulo, deal_id, cliente_id, lead_id, consultor_id, template_id, projeto_id
    INTO v_source
    FROM propostas_nativas
   WHERE id = p_source_proposta_id
     AND tenant_id = v_tenant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'source_not_found');
  END IF;

  SELECT id, snapshot, valor_total, potencia_kwp, economia_mensal, geracao_mensal, payback_meses
    INTO v_source_versao
    FROM proposta_versoes
   WHERE proposta_id = p_source_proposta_id
   ORDER BY versao_numero DESC
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'source_version_not_found');
  END IF;

  v_resolved_deal_id := coalesce(p_target_deal_id, v_source.deal_id);
  v_resolved_cliente_id := coalesce(p_target_cliente_id, v_source.cliente_id);

  IF p_target_deal_id IS NOT NULL THEN
    SELECT id INTO v_resolved_projeto_id
      FROM projetos
     WHERE deal_id = p_target_deal_id AND tenant_id = v_tenant_id
     LIMIT 1;
  END IF;
  v_resolved_projeto_id := coalesce(v_resolved_projeto_id, v_source.projeto_id);

  INSERT INTO propostas_nativas (
    tenant_id, titulo, deal_id, lead_id, cliente_id, consultor_id,
    template_id, projeto_id, status, created_by, versao_atual, is_principal
  ) VALUES (
    v_tenant_id,
    coalesce(p_titulo, v_source.titulo || ' (Cópia)'),
    v_resolved_deal_id,
    v_source.lead_id,
    v_resolved_cliente_id,
    v_source.consultor_id,
    v_source.template_id,
    v_resolved_projeto_id,
    'draft'::proposta_nativa_status,
    v_user_id,
    1,
    false
  )
  RETURNING id INTO v_new_proposta_id;

  INSERT INTO proposta_versoes (
    proposta_id, tenant_id, versao_numero, snapshot,
    valor_total, potencia_kwp, economia_mensal, geracao_mensal,
    payback_meses, status, created_at, updated_at
  ) VALUES (
    v_new_proposta_id, v_tenant_id, 1, v_source_versao.snapshot,
    v_source_versao.valor_total, v_source_versao.potencia_kwp,
    v_source_versao.economia_mensal, v_source_versao.geracao_mensal,
    v_source_versao.payback_meses, 'draft'::proposta_nativa_status, now(), now()
  )
  RETURNING id INTO v_new_versao_id;

  INSERT INTO proposta_versao_ucs (
    versao_id, nome, consumo_mensal_kwh, geracao_mensal_estimada,
    tarifa_energia, percentual_atendimento, is_geradora, ordem,
    tipo_fornecimento, tensao_nominal, numero_uc, distribuidora_nome, tenant_id
  )
  SELECT
    v_new_versao_id, nome, consumo_mensal_kwh, geracao_mensal_estimada,
    tarifa_energia, percentual_atendimento, is_geradora, ordem,
    tipo_fornecimento, tensao_nominal, numero_uc, distribuidora_nome, v_tenant_id
  FROM proposta_versao_ucs
  WHERE versao_id = v_source_versao.id;

  BEGIN
    INSERT INTO proposal_events (proposta_id, tenant_id, tipo, payload)
    VALUES (v_new_proposta_id, v_tenant_id, 'cloned', jsonb_build_object(
      'source_proposta_id', p_source_proposta_id,
      'source_versao_id', v_source_versao.id,
      'versao_id', v_new_versao_id,
      'cloned_by', v_user_id
    ));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'proposta_id', v_new_proposta_id,
    'versao_id', v_new_versao_id,
    'versao_numero', 1
  );
END;
$$;