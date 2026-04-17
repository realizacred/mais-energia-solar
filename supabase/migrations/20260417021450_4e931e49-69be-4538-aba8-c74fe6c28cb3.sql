-- =====================================================================
-- Onda 2 (corrigida): Infraestrutura de apply SM → nativo
-- =====================================================================

-- 1) Garantir funis e etapas canônicos
CREATE OR REPLACE FUNCTION public.sm_ensure_canonical_pipelines(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_funis_criados int := 0;
  v_etapas_criadas int := 0;
  v_funil_id uuid;
  v_def jsonb := jsonb_build_object(
    'Comercial', jsonb_build_array(
      jsonb_build_object('nome','Novo',             'cor','#6366f1','categoria','aberto'),
      jsonb_build_object('nome','Contato',          'cor','#3b82f6','categoria','aberto'),
      jsonb_build_object('nome','Proposta enviada', 'cor','#f59e0b','categoria','aberto'),
      jsonb_build_object('nome','Em negociação',    'cor','#8b5cf6','categoria','aberto'),
      jsonb_build_object('nome','Fechado',          'cor','#10b981','categoria','ganho'),
      jsonb_build_object('nome','Perdido',          'cor','#ef4444','categoria','perdido')
    )
  );
  v_funil_nome text;
  v_etapas jsonb;
  v_etapa jsonb;
  v_ord int;
BEGIN
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'p_tenant_id obrigatório'; END IF;

  FOR v_funil_nome, v_etapas IN SELECT * FROM jsonb_each(v_def) LOOP
    SELECT id INTO v_funil_id
    FROM public.projeto_funis
    WHERE tenant_id = p_tenant_id AND lower(unaccent(nome)) = lower(unaccent(v_funil_nome))
    LIMIT 1;

    IF v_funil_id IS NULL THEN
      INSERT INTO public.projeto_funis (tenant_id, nome, ordem, ativo)
      VALUES (
        p_tenant_id, v_funil_nome,
        COALESCE((SELECT MAX(ordem)+1 FROM public.projeto_funis WHERE tenant_id=p_tenant_id), 1),
        true
      )
      RETURNING id INTO v_funil_id;
      v_funis_criados := v_funis_criados + 1;
    END IF;

    v_ord := COALESCE((SELECT MAX(ordem) FROM public.projeto_etapas WHERE funil_id=v_funil_id), 0);
    FOR v_etapa IN SELECT * FROM jsonb_array_elements(v_etapas) LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.projeto_etapas
        WHERE funil_id=v_funil_id
          AND lower(unaccent(nome)) = lower(unaccent(v_etapa->>'nome'))
      ) THEN
        v_ord := v_ord + 1;
        INSERT INTO public.projeto_etapas (tenant_id, funil_id, nome, ordem, cor, categoria)
        VALUES (p_tenant_id, v_funil_id, v_etapa->>'nome', v_ord, v_etapa->>'cor', v_etapa->>'categoria');
        v_etapas_criadas := v_etapas_criadas + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('funis_criados', v_funis_criados, 'etapas_criadas', v_etapas_criadas);
END;
$function$;

-- 2) Resolver/criar cliente a partir de raw_payload->client
CREATE OR REPLACE FUNCTION public.sm_resolve_or_create_cliente(
  p_tenant_id uuid,
  p_raw_payload jsonb,
  p_dry_run boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_client jsonb := COALESCE(p_raw_payload->'client', '{}'::jsonb);
  v_nome text := btrim(COALESCE(v_client->>'name',''));
  v_tel  text := btrim(COALESCE(v_client->>'primaryPhone',''));
  v_tel_norm text;
  v_cliente_id uuid;
BEGIN
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'p_tenant_id obrigatório'; END IF;
  IF v_nome = '' AND v_tel = '' THEN RETURN NULL; END IF;
  IF v_nome = '' THEN v_nome := 'Cliente SM ' || COALESCE(v_client->>'id','sem-id'); END IF;
  IF v_tel = '' THEN v_tel := '00000000000'; END IF;

  v_tel_norm := public.normalize_phone(v_tel);

  IF v_tel_norm IS NOT NULL AND v_tel_norm <> '' THEN
    SELECT id INTO v_cliente_id
    FROM public.clientes
    WHERE tenant_id = p_tenant_id AND telefone_normalized = v_tel_norm
    ORDER BY created_at ASC LIMIT 1;
    IF v_cliente_id IS NOT NULL THEN RETURN v_cliente_id; END IF;
  END IF;

  IF p_dry_run THEN
    -- Sinaliza "criaria novo" sem persistir
    RETURN '00000000-0000-0000-0000-000000000000'::uuid;
  END IF;

  INSERT INTO public.clientes (
    tenant_id, nome, telefone, telefone_normalized,
    cep, cidade, estado, bairro, complemento,
    import_source, origem
  )
  VALUES (
    p_tenant_id, v_nome, v_tel, v_tel_norm,
    NULLIF(v_client->>'zipCode',''),
    NULLIF(v_client->>'city',''),
    NULLIF(v_client->>'state',''),
    NULLIF(v_client->>'neighborhood',''),
    NULLIF(v_client->>'complement',''),
    'solar_market', 'solar_market'
  )
  RETURNING id INTO v_cliente_id;

  RETURN v_cliente_id;
END;
$function$;

-- 3) Apply idempotente. p_dry_run=true => apenas conta, não escreve.
CREATE OR REPLACE FUNCTION public.sm_migration_apply(
  p_tenant_id uuid,
  p_dry_run boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_inserted int := 0;
  v_updated int := 0;
  v_would_insert int := 0;
  v_would_update int := 0;
  v_clientes_novos int := 0;
  v_skipped_resp int := 0;
  v_skipped_fin  int := 0;
  v_skipped_unm  int := 0;
  v_no_classif   int := 0;
  v_no_cliente   int := 0;
  v_errors       int := 0;
  r record;
  v_cls jsonb;
  v_funil_id uuid;
  v_etapa_id uuid;
  v_consultor_id uuid;
  v_cliente_id uuid;
  v_existing_id uuid;
  v_escritorio_id uuid;
BEGIN
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'p_tenant_id obrigatório'; END IF;

  -- Em modo apply real, garantir funis/etapas canônicos antes
  IF NOT p_dry_run THEN
    PERFORM public.sm_ensure_canonical_pipelines(p_tenant_id);
  END IF;

  SELECT id INTO v_escritorio_id
  FROM public.consultores
  WHERE tenant_id = p_tenant_id AND ativo = true
    AND lower(unaccent(nome)) IN ('escritorio','consultor escritorio')
  ORDER BY created_at ASC LIMIT 1;

  FOR r IN
    SELECT smp.id, smp.sm_project_id, smp.lead_id, smp.responsible,
           smp.sm_funnel_name, smp.sm_stage_name, smp.status, smp.raw_payload,
           smp.potencia_kwp, smp.valor
    FROM public.solar_market_projects smp
    WHERE smp.tenant_id = p_tenant_id
      AND smp.sm_project_id IS NOT NULL
  LOOP
    BEGIN
      v_cls := public.sm_classify_funnel_stage(p_tenant_id, r.sm_funnel_name, r.sm_stage_name, r.status);

      IF (v_cls->>'pipeline_kind') = 'responsible_only' THEN v_skipped_resp := v_skipped_resp+1; CONTINUE; END IF;
      IF (v_cls->>'pipeline_kind') = 'financial_dimension' THEN v_skipped_fin := v_skipped_fin+1; CONTINUE; END IF;
      IF (v_cls->>'pipeline_kind') = 'unmapped' THEN v_skipped_unm := v_skipped_unm+1; CONTINUE; END IF;
      IF (v_cls->>'funil_canonico') IS NULL OR (v_cls->>'etapa_canonica') IS NULL THEN
        v_no_classif := v_no_classif+1; CONTINUE;
      END IF;

      -- Resolver funil + etapa
      SELECT id INTO v_funil_id FROM public.projeto_funis
       WHERE tenant_id=p_tenant_id AND lower(unaccent(nome))=lower(unaccent(v_cls->>'funil_canonico'))
       LIMIT 1;

      IF v_funil_id IS NULL THEN
        IF p_dry_run THEN
          -- não cria; apenas conta
          NULL;
        ELSE
          INSERT INTO public.projeto_funis (tenant_id, nome, ordem, ativo)
          VALUES (p_tenant_id, v_cls->>'funil_canonico',
                  COALESCE((SELECT MAX(ordem)+1 FROM public.projeto_funis WHERE tenant_id=p_tenant_id),1), true)
          RETURNING id INTO v_funil_id;
        END IF;
      END IF;

      IF v_funil_id IS NOT NULL THEN
        SELECT id INTO v_etapa_id FROM public.projeto_etapas
         WHERE funil_id=v_funil_id AND lower(unaccent(nome))=lower(unaccent(v_cls->>'etapa_canonica'))
         LIMIT 1;
        IF v_etapa_id IS NULL AND NOT p_dry_run THEN
          INSERT INTO public.projeto_etapas (tenant_id, funil_id, nome, ordem, cor, categoria)
          VALUES (p_tenant_id, v_funil_id, v_cls->>'etapa_canonica',
                  COALESCE((SELECT MAX(ordem)+1 FROM public.projeto_etapas WHERE funil_id=v_funil_id),1),
                  '#6366f1','aberto')
          RETURNING id INTO v_etapa_id;
        END IF;
      END IF;

      -- Consultor
      v_consultor_id := NULL;
      IF r.responsible IS NOT NULL AND (r.responsible->>'name') IS NOT NULL THEN
        SELECT id INTO v_consultor_id FROM public.consultores
         WHERE tenant_id=p_tenant_id AND ativo=true
           AND lower(unaccent(nome)) = lower(unaccent(r.responsible->>'name'))
         ORDER BY created_at ASC LIMIT 1;
      END IF;
      IF v_consultor_id IS NULL THEN v_consultor_id := v_escritorio_id; END IF;

      -- Já existe projeto vinculado?
      SELECT id INTO v_existing_id FROM public.projetos
       WHERE tenant_id=p_tenant_id AND sm_project_id = r.sm_project_id
       LIMIT 1;

      IF v_existing_id IS NOT NULL THEN
        IF p_dry_run THEN
          v_would_update := v_would_update + 1;
        ELSE
          UPDATE public.projetos
             SET funil_id = v_funil_id,
                 etapa_id = v_etapa_id,
                 consultor_id = COALESCE(consultor_id, v_consultor_id),
                 updated_at = now()
           WHERE id = v_existing_id;
          v_updated := v_updated + 1;
        END IF;
      ELSE
        v_cliente_id := public.sm_resolve_or_create_cliente(p_tenant_id, r.raw_payload, p_dry_run);
        IF v_cliente_id IS NULL THEN
          v_no_cliente := v_no_cliente + 1; CONTINUE;
        END IF;

        IF p_dry_run THEN
          v_would_insert := v_would_insert + 1;
          IF v_cliente_id = '00000000-0000-0000-0000-000000000000'::uuid THEN
            v_clientes_novos := v_clientes_novos + 1;
          END IF;
        ELSE
          INSERT INTO public.projetos (
            tenant_id, codigo, cliente_id, lead_id, consultor_id,
            funil_id, etapa_id, sm_project_id,
            potencia_kwp, valor_total,
            import_source, origem
          )
          VALUES (
            p_tenant_id,
            'PRJ-SM-' || r.sm_project_id::text,
            v_cliente_id,
            r.lead_id,
            v_consultor_id,
            v_funil_id, v_etapa_id, r.sm_project_id,
            r.potencia_kwp,
            r.valor,
            'solar_market', 'solar_market'
          );
          v_inserted := v_inserted + 1;
        END IF;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      RAISE WARNING '[sm_migration_apply] sm_project_id=% erro: %', r.sm_project_id, SQLERRM;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'tenant_id', p_tenant_id,
    'dry_run', p_dry_run,
    'projetos_inserted', v_inserted,
    'projetos_updated',  v_updated,
    'projetos_would_insert', v_would_insert,
    'projetos_would_update', v_would_update,
    'clientes_novos_estimados', v_clientes_novos,
    'skipped_responsible_only', v_skipped_resp,
    'skipped_financial',        v_skipped_fin,
    'skipped_unmapped',         v_skipped_unm,
    'sem_classificacao_completa', v_no_classif,
    'sem_cliente_resolvel',     v_no_cliente,
    'erros', v_errors,
    'consultor_escritorio_id', v_escritorio_id
  );
END;
$function$;