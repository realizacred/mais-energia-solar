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

  -- ─── RB-60/RB-61: garantir funil/etapa de execução + pipeline/stage comercial ───
  IF v_projeto_id IS NULL THEN
    -- Resolver consultor a partir do user atual (fallback NULL se não houver)
    SELECT c.id INTO v_consultor_id
    FROM consultores c
    WHERE c.user_id = auth.uid() AND c.ativo = true
    LIMIT 1;

    -- Funil de execução (projeto_funis): preferir 'Comercial', fallback primeiro ativo
    SELECT id INTO v_funil_id
    FROM projeto_funis
    WHERE tenant_id = v_tenant_id AND ativo = true AND lower(nome) = 'comercial'
    ORDER BY ordem ASC LIMIT 1;

    IF v_funil_id IS NULL THEN
      SELECT id INTO v_funil_id
      FROM projeto_funis
      WHERE tenant_id = v_tenant_id AND ativo = true
      ORDER BY ordem ASC LIMIT 1;
    END IF;

    IF v_funil_id IS NOT NULL THEN
      SELECT id INTO v_etapa_id
      FROM projeto_etapas
      WHERE funil_id = v_funil_id
      ORDER BY ordem ASC LIMIT 1;
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

  -- Garantir deal vinculado (RB-60: nunca projeto sem deal)
  IF v_deal_id IS NULL AND v_projeto_id IS NOT NULL THEN
    SELECT d.id INTO v_deal_id
    FROM deals d WHERE d.projeto_id = v_projeto_id LIMIT 1;
  END IF;

  IF v_deal_id IS NULL AND v_projeto_id IS NOT NULL THEN
    -- Resolver consultor (caso projeto pré-existente sem consultor)
    IF v_consultor_id IS NULL THEN
      SELECT c.id INTO v_consultor_id
      FROM consultores c
      WHERE c.user_id = auth.uid() AND c.ativo = true
      LIMIT 1;
    END IF;

    -- Garantir pipeline default
    PERFORM public.ensure_tenant_default_pipeline(v_tenant_id);

    SELECT id INTO v_pipeline_id
    FROM pipelines
    WHERE tenant_id = v_tenant_id AND is_default = true AND is_active = true
    ORDER BY created_at ASC LIMIT 1;

    IF v_pipeline_id IS NULL THEN
      SELECT id INTO v_pipeline_id
      FROM pipelines
      WHERE tenant_id = v_tenant_id AND is_active = true
      ORDER BY created_at ASC LIMIT 1;
    END IF;

    IF v_pipeline_id IS NOT NULL THEN
      SELECT id INTO v_stage_id
      FROM pipeline_stages
      WHERE pipeline_id = v_pipeline_id AND is_closed = false
      ORDER BY position ASC LIMIT 1;

      IF v_stage_id IS NOT NULL AND v_consultor_id IS NOT NULL THEN
        INSERT INTO deals (
          tenant_id, title, customer_id, owner_id, pipeline_id, stage_id,
          projeto_id, value, status
        )
        VALUES (
          v_tenant_id, COALESCE(NULLIF(btrim(p_titulo), ''), 'Proposta'),
          v_cliente_id, v_consultor_id, v_pipeline_id, v_stage_id,
          v_projeto_id, COALESCE(p_valor_total, 0), 'open'
        )
        RETURNING id INTO v_deal_id;

        UPDATE projetos SET deal_id = v_deal_id WHERE id = v_projeto_id;
      END IF;
    END IF;
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