
-- ─── 1. RPC proposal_create_version (FIX schema drift) ──────────────────
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

-- ─── 2. create_proposta_nativa_atomic: explicitar is_official=false ──────
-- Apenas a INSERT da versão inicial muda; todo o restante é preservado.
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
  v_funil_id uuid;
  v_etapa_id uuid;
  v_pipeline_id uuid;
  v_stage_id uuid;
  v_consultor_id uuid;
BEGIN
  v_snapshot := public.normalize_proposta_snapshot(p_snapshot);

  SELECT p.tenant_id INTO v_tenant_id
  FROM profiles p WHERE p.user_id = auth.uid();

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant não encontrado para o usuário atual';
  END IF;

  v_projeto_id := p_projeto_id;
  v_deal_id := p_deal_id;

  IF v_deal_id IS NOT NULL AND v_projeto_id IS NULL THEN
    SELECT projeto_id INTO v_projeto_id FROM deals WHERE id = v_deal_id;
  END IF;

  SELECT COALESCE(
    (SELECT c.id FROM consultores c
       JOIN deals d ON d.owner_id = c.user_id
      WHERE d.id = v_deal_id LIMIT 1),
    (SELECT l.consultor_id FROM leads l WHERE l.id = p_lead_id LIMIT 1),
    (SELECT proj.consultor_id FROM projetos proj WHERE proj.id = v_projeto_id LIMIT 1)
  ) INTO v_consultor_id;

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
    SELECT proj.cliente_id INTO v_cliente_id FROM projetos proj WHERE proj.id = v_projeto_id;
  END IF;
  IF v_cliente_id IS NULL AND v_deal_id IS NOT NULL THEN
    SELECT d.customer_id INTO v_cliente_id FROM deals d WHERE d.id = v_deal_id;
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
    SELECT id INTO v_funil_id FROM projeto_funis
    WHERE tenant_id = v_tenant_id AND ativo = true AND lower(nome) = 'comercial'
    ORDER BY ordem ASC LIMIT 1;
    IF v_funil_id IS NULL THEN
      SELECT id INTO v_funil_id FROM projeto_funis
      WHERE tenant_id = v_tenant_id AND ativo = true ORDER BY ordem ASC LIMIT 1;
    END IF;
    IF v_funil_id IS NOT NULL THEN
      SELECT id INTO v_etapa_id FROM projeto_etapas
      WHERE funil_id = v_funil_id ORDER BY ordem ASC LIMIT 1;
    END IF;

    INSERT INTO projetos (
      tenant_id, lead_id, cliente_id, consultor_id, status, is_principal,
      funil_id, etapa_id, valor_total
    )
    VALUES (
      v_tenant_id, p_lead_id, v_cliente_id, v_consultor_id, 'criado',
      NOT EXISTS (SELECT 1 FROM projetos WHERE cliente_id = v_cliente_id AND is_principal = true),
      v_funil_id, v_etapa_id, COALESCE(p_valor_total, 0)
    )
    RETURNING id INTO v_projeto_id;
  END IF;

  IF v_deal_id IS NULL AND v_projeto_id IS NOT NULL THEN
    SELECT d.id INTO v_deal_id FROM deals d WHERE d.projeto_id = v_projeto_id LIMIT 1;
  END IF;

  IF v_deal_id IS NULL AND v_projeto_id IS NOT NULL THEN
    PERFORM public.ensure_tenant_default_pipeline(v_tenant_id);
    SELECT id INTO v_pipeline_id FROM pipelines
    WHERE tenant_id = v_tenant_id AND is_default = true AND is_active = true
    ORDER BY created_at ASC LIMIT 1;
    IF v_pipeline_id IS NULL THEN
      SELECT id INTO v_pipeline_id FROM pipelines
      WHERE tenant_id = v_tenant_id AND is_active = true
      ORDER BY created_at ASC LIMIT 1;
    END IF;
    IF v_pipeline_id IS NOT NULL THEN
      SELECT id INTO v_stage_id FROM pipeline_stages
      WHERE pipeline_id = v_pipeline_id AND is_closed = false
      ORDER BY position ASC LIMIT 1;
      IF v_stage_id IS NOT NULL AND v_consultor_id IS NOT NULL THEN
        INSERT INTO deals (
          tenant_id, title, customer_id, owner_id, pipeline_id, stage_id,
          projeto_id, value, status
        )
        VALUES (
          v_tenant_id, COALESCE(NULLIF(btrim(p_titulo), ''), 'Proposta'),
          v_cliente_id,
          (SELECT user_id FROM consultores WHERE id = v_consultor_id LIMIT 1),
          v_pipeline_id, v_stage_id,
          v_projeto_id, COALESCE(p_valor_total, 0), 'open'
        )
        RETURNING id INTO v_deal_id;
        UPDATE projetos SET deal_id = v_deal_id WHERE id = v_projeto_id;
      END IF;
    END IF;
  END IF;

  INSERT INTO propostas_nativas (
    tenant_id, titulo, lead_id, cliente_id, projeto_id, deal_id, origem, status,
    consultor_id, created_by
  ) VALUES (
    v_tenant_id, p_titulo, p_lead_id, v_cliente_id, v_projeto_id, v_deal_id, p_origem, 'rascunho',
    v_consultor_id, auth.uid()
  ) RETURNING id INTO v_proposta_id;

  -- Versão inicial é sempre rascunho ⇒ is_official=false
  INSERT INTO proposta_versoes (
    tenant_id, proposta_id, versao_numero, status,
    potencia_kwp, valor_total, grupo, geracao_mensal, economia_mensal, snapshot,
    is_official
  ) VALUES (
    v_tenant_id, v_proposta_id, 1, 'rascunho'::public.proposta_nativa_status,
    p_potencia_kwp, p_valor_total, v_grupo, v_geracao_mensal, NULL, v_snapshot,
    FALSE
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

-- ─── 3. Trigger SSOT: sync valor oficial → deals/projetos ───────────────
CREATE OR REPLACE FUNCTION public.sync_proposal_value_to_deal_projeto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_deal_id uuid;
  v_projeto_id uuid;
BEGIN
  -- Só age quando esta versão é a oficial.
  IF NEW.is_official IS DISTINCT FROM TRUE THEN
    RETURN NEW;
  END IF;

  -- Em UPDATE, só dispara se algo relevante mudou.
  IF TG_OP = 'UPDATE' THEN
    IF NEW.valor_total IS NOT DISTINCT FROM OLD.valor_total
       AND NEW.potencia_kwp IS NOT DISTINCT FROM OLD.potencia_kwp
       AND NEW.is_official IS NOT DISTINCT FROM OLD.is_official THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT deal_id, projeto_id INTO v_deal_id, v_projeto_id
  FROM public.propostas_nativas
  WHERE id = NEW.proposta_id;

  IF v_deal_id IS NOT NULL THEN
    UPDATE public.deals
    SET value = COALESCE(NEW.valor_total, value),
        kwp = COALESCE(NEW.potencia_kwp, kwp),
        updated_at = now()
    WHERE id = v_deal_id;
  END IF;

  IF v_projeto_id IS NOT NULL THEN
    UPDATE public.projetos
    SET valor_total = COALESCE(NEW.valor_total, valor_total),
        potencia_kwp = COALESCE(NEW.potencia_kwp, potencia_kwp),
        updated_at = now()
    WHERE id = v_projeto_id;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_sync_proposal_value ON public.proposta_versoes;
CREATE TRIGGER tr_sync_proposal_value
AFTER INSERT OR UPDATE OF valor_total, potencia_kwp, is_official ON public.proposta_versoes
FOR EACH ROW
EXECUTE FUNCTION public.sync_proposal_value_to_deal_projeto();
