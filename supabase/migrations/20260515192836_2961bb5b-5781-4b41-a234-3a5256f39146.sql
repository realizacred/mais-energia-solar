
-- Recriar a função proposal_create_version com os nomes de colunas corretos
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
  v_new_versao_id uuid;
  v_is_official   boolean;
  v_tenant_id     uuid;
  v_status        public.proposta_nativa_status;
  v_now           timestamptz := now();
  v_result        jsonb;
BEGIN
  -- Intent → flag oficial. 'active'|'published'|'generated'|'sent' = oficial.
  v_is_official := p_intent IN ('active', 'published', 'generated', 'sent');

  -- Resolver tenant da proposta-mãe (RB: multi-tenant obrigatório).
  SELECT tenant_id INTO v_tenant_id
  FROM public.propostas_nativas
  WHERE id = p_proposta_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Proposta % não encontrada (tenant nulo)', p_proposta_id;
  END IF;

  -- Atualiza draft no registro mãe.
  UPDATE public.propostas_nativas
  SET draft_total = p_valor_total,
      has_unpublished_changes = NOT v_is_official,
      updated_at = v_now
  WHERE id = p_proposta_id;

  -- Marca versões anteriores como não-oficiais quando esta vai ser a oficial.
  IF v_is_official THEN
    UPDATE public.proposta_versoes
    SET is_official = FALSE,
        substituida_em = COALESCE(substituida_em, v_now)
    WHERE proposta_id = p_proposta_id
      AND is_official = TRUE;
  END IF;

  v_status := CASE
    WHEN v_is_official THEN 'gerada'::public.proposta_nativa_status
    ELSE 'rascunho'::public.proposta_nativa_status
  END;

  -- Cria nova versão com schema correto (valido_ate, tenant_id, is_official).
  INSERT INTO public.proposta_versoes (
    tenant_id,
    proposta_id,
    versao_numero,
    snapshot,
    potencia_kwp,
    valor_total,
    economia_mensal,
    geracao_mensal,
    grupo,
    idempotency_key,
    calc_hash,
    engine_version,
    validade_dias,
    valido_ate,
    observacoes,
    gerado_por,
    gerado_em,
    generated_at,
    payback_meses,
    status,
    is_official
  )
  SELECT
    v_tenant_id,
    p_proposta_id,
    COALESCE((SELECT MAX(versao_numero) FROM public.proposta_versoes WHERE proposta_id = p_proposta_id), 0) + 1,
    p_snapshot,
    p_potencia_kwp,
    p_valor_total,
    p_economia_mensal,
    p_geracao_mensal,
    p_grupo,
    p_idempotency_key,
    p_calc_hash,
    p_engine_version,
    p_validade_dias,
    CASE WHEN v_is_official THEN (v_now + (p_validade_dias || ' days')::interval) ELSE NULL END,
    p_observacoes,
    p_gerado_por,
    CASE WHEN v_is_official THEN v_now ELSE NULL END,
    CASE WHEN v_is_official THEN v_now ELSE NULL END,
    p_payback_meses,
    v_status,
    v_is_official
  RETURNING id INTO v_new_versao_id;

  -- Atualiza status da proposta-mãe quando oficial.
  IF v_is_official THEN
    UPDATE public.propostas_nativas
    SET status = 'gerada'::public.proposta_nativa_status,
        versao_atual = (SELECT versao_numero FROM public.proposta_versoes WHERE id = v_new_versao_id),
        updated_at = v_now
    WHERE id = p_proposta_id;
  END IF;

  v_result := jsonb_build_object(
    'versao_id', v_new_versao_id,
    'proposta_id', p_proposta_id,
    'intent', p_intent,
    'is_official', v_is_official,
    'new_version_created', true
  );
  RETURN v_result;
END;
$function$;
