CREATE OR REPLACE FUNCTION public.proposal_clone(p_source_proposta_id uuid, p_titulo text DEFAULT NULL::text, p_target_deal_id uuid DEFAULT NULL::uuid, p_target_cliente_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_new_num bigint;
  v_new_codigo text;
  v_attempts int := 0;
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

  -- Generate unique codigo with collision retry (defense in depth)
  LOOP
    v_attempts := v_attempts + 1;
    v_new_num := public.next_tenant_number(v_tenant_id, 'proposta');
    v_new_codigo := 'PROP-' || lpad(v_new_num::text, 4, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM propostas_nativas
       WHERE tenant_id = v_tenant_id AND codigo = v_new_codigo
    );
    IF v_attempts > 50 THEN
      RETURN jsonb_build_object('error', 'codigo_generation_failed');
    END IF;
  END LOOP;

  INSERT INTO propostas_nativas (
    tenant_id, titulo, codigo, proposta_num,
    deal_id, lead_id, cliente_id, consultor_id,
    template_id, projeto_id, status, created_by, versao_atual, is_principal
  ) VALUES (
    v_tenant_id,
    coalesce(p_titulo, v_source.titulo || ' (Cópia)'),
    v_new_codigo,
    v_new_num,
    v_resolved_deal_id,
    v_source.lead_id,
    v_resolved_cliente_id,
    v_source.consultor_id,
    v_source.template_id,
    v_resolved_projeto_id,
    'draft',
    v_user_id,
    1,
    false
  )
  RETURNING id INTO v_new_proposta_id;

  INSERT INTO proposta_versoes (
    proposta_id, tenant_id, versao_numero, snapshot,
    valor_total, potencia_kwp, economia_mensal, geracao_mensal, payback_meses
  ) VALUES (
    v_new_proposta_id,
    v_tenant_id,
    1,
    v_source_versao.snapshot,
    v_source_versao.valor_total,
    v_source_versao.potencia_kwp,
    v_source_versao.economia_mensal,
    v_source_versao.geracao_mensal,
    v_source_versao.payback_meses
  )
  RETURNING id INTO v_new_versao_id;

  INSERT INTO proposta_versao_ucs (
    versao_id, tenant_id, ordem, nome, numero_uc, titular,
    concessionaria_id, tipo_ligacao, grupo, modalidade,
    consumo_mensal_kwh, consumo_ponta_kwh, consumo_fora_ponta_kwh,
    demanda_contratada_kw, tarifa_energia, tarifa_fio_b,
    tarifa_ponta, tarifa_fora_ponta, aliquota_icms,
    percentual_atendimento, potencia_necessaria_kwp,
    geracao_mensal_estimada, metadata
  )
  SELECT
    v_new_versao_id, v_tenant_id, ordem, nome, numero_uc, titular,
    concessionaria_id, tipo_ligacao, grupo, modalidade,
    consumo_mensal_kwh, consumo_ponta_kwh, consumo_fora_ponta_kwh,
    demanda_contratada_kw, tarifa_energia, tarifa_fio_b,
    tarifa_ponta, tarifa_fora_ponta, aliquota_icms,
    percentual_atendimento, potencia_necessaria_kwp,
    geracao_mensal_estimada, metadata
    FROM proposta_versao_ucs
   WHERE versao_id = v_source_versao.id;

  RETURN jsonb_build_object(
    'proposta_id', v_new_proposta_id,
    'versao_id', v_new_versao_id,
    'codigo', v_new_codigo
  );
END;
$function$;