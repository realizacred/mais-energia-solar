-- =====================================================================
-- Onda 1.1: Atualiza classificador canônico SM → CRM nativo
-- Mudança de regra: sm_funnel_name ausente NÃO é mais "unmapped".
-- Vai para funil canônico "Comercial", com etapa derivada de status.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.sm_classify_funnel_stage(
  p_tenant_id uuid,
  p_funnel_name text,
  p_stage_name text,
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_funnel_norm text;
  v_stage_norm  text;
  v_status_norm text;
  v_pipeline_kind text;
  v_funil_canonico text;
  v_etapa_canonica text;
  v_consultor_match_nome text;
  v_motivo text;
BEGIN
  v_funnel_norm := btrim(coalesce(p_funnel_name, ''));
  v_stage_norm  := btrim(coalesce(p_stage_name, ''));
  v_status_norm := lower(btrim(coalesce(p_status, '')));

  -- Helper inline: derivar etapa Comercial a partir de status/stage livre
  -- Mapeamento canônico explícito; default seguro = "Novo".
  -- (sem hardcode de Engenharia, sem fallback genérico fora de Comercial)
  -- 1) PRIMEIRO: regras de funil de origem que NÃO entram no pipeline principal
  -- ---------------------------------------------------------------------------

  -- Vendedores → dimensão de responsável, nunca pipeline
  IF lower(v_funnel_norm) = 'vendedores' THEN
    v_consultor_match_nome := v_stage_norm;
    RETURN jsonb_build_object(
      'pipeline_kind', 'responsible_only',
      'funil_canonico', NULL,
      'etapa_canonica', NULL,
      'consultor_match_nome', v_consultor_match_nome,
      'deve_ignorar_pipeline', true,
      'motivo_classificacao', 'funil Vendedores → responsável'
    );
  END IF;

  -- Funis financeiros → dimensão paralela
  IF v_funnel_norm <> '' AND v_funnel_norm ~* '(pagamento|financeiro|cobran[çc]a|recebimento|faturamento|financiamento)' THEN
    RETURN jsonb_build_object(
      'pipeline_kind', 'financial_dimension',
      'funil_canonico', NULL,
      'etapa_canonica', NULL,
      'consultor_match_nome', NULL,
      'deve_ignorar_pipeline', true,
      'motivo_classificacao', 'funil financeiro → dimensão paralela'
    );
  END IF;

  -- 2) Normalização de typos da origem
  IF lower(v_funnel_norm) = 'compesação'        THEN v_funnel_norm := 'Compensação'; END IF;
  IF lower(v_funnel_norm) = 'compesação aceita' THEN v_funnel_norm := 'Compensação aceita'; END IF;
  IF lower(v_stage_norm)  = 'compesação'        THEN v_stage_norm  := 'Compensação'; END IF;
  IF lower(v_stage_norm)  = 'compesação aceita' THEN v_stage_norm  := 'Compensação aceita'; END IF;

  -- 3) Funil de origem AUSENTE  → funil canônico "Comercial" (NOVA REGRA)
  --    A etapa é derivada do status/stage livre, com default "Novo".
  IF v_funnel_norm = '' THEN
    v_funil_canonico := 'Comercial';
    v_pipeline_kind  := 'commercial';

    -- Mapa explícito status → etapa Comercial
    v_etapa_canonica := CASE
      WHEN v_status_norm IN ('perdido','lost','perdida') THEN 'Perdido'
      WHEN v_status_norm IN ('ganho','ganha','fechado','fechada','won','vendido') THEN 'Fechado'
      WHEN v_status_norm IN ('proposta enviada','proposta','enviada','sent') THEN 'Proposta enviada'
      WHEN v_status_norm IN ('em negociacao','em negociação','negociacao','negociação','negotiating') THEN 'Em negociação'
      WHEN v_status_norm IN ('contato','contatado','contacted') THEN 'Contato'
      WHEN v_status_norm = '' THEN 'Novo'
      ELSE 'Novo' -- default seguro dentro de Comercial; nunca Engenharia
    END;

    v_motivo := 'sm_funnel_name ausente → Comercial (etapa: ' || v_etapa_canonica || ')';

    RETURN jsonb_build_object(
      'pipeline_kind', v_pipeline_kind,
      'funil_canonico', v_funil_canonico,
      'etapa_canonica', v_etapa_canonica,
      'consultor_match_nome', NULL,
      'deve_ignorar_pipeline', false,
      'motivo_classificacao', v_motivo
    );
  END IF;

  -- 4) LEAD → Comercial (canonização explícita)
  IF lower(v_funnel_norm) = 'lead' THEN
    v_funil_canonico := 'Comercial';
    v_pipeline_kind  := 'commercial';
    v_etapa_canonica := CASE
      WHEN v_stage_norm = '' THEN 'Novo'
      WHEN lower(v_stage_norm) IN ('perdido','lost') THEN 'Perdido'
      WHEN lower(v_stage_norm) IN ('ganho','fechado','won') THEN 'Fechado'
      ELSE v_stage_norm
    END;
    v_motivo := 'LEAD traduzido para Comercial';
  ELSE
    -- 5) Demais funis técnicos/operacionais: passthrough do nome
    v_funil_canonico := v_funnel_norm;
    v_etapa_canonica := NULLIF(v_stage_norm, '');
    v_pipeline_kind  := 'technical';
    v_motivo := 'funil técnico/operacional passthrough';
  END IF;

  IF v_etapa_canonica IS NULL THEN
    v_motivo := v_motivo || ' (sem etapa)';
  END IF;

  RETURN jsonb_build_object(
    'pipeline_kind', v_pipeline_kind,
    'funil_canonico', v_funil_canonico,
    'etapa_canonica', v_etapa_canonica,
    'consultor_match_nome', NULL,
    'deve_ignorar_pipeline', false,
    'motivo_classificacao', v_motivo
  );
END;
$function$;

-- =====================================================================
-- Atualizar dry-run para passar smp.status ao classificador
-- e refletir consultor fallback "Consultor Escritório" no relatório.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.sm_migration_dry_run(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id obrigatório';
  END IF;

  WITH classified AS (
    SELECT
      smp.sm_project_id,
      smp.lead_id,
      smp.sm_funnel_name,
      smp.sm_stage_name,
      smp.status AS sm_status,
      smp.responsible,
      public.sm_classify_funnel_stage(
        p_tenant_id,
        smp.sm_funnel_name,
        smp.sm_stage_name,
        smp.status
      ) AS cls
    FROM public.solar_market_projects smp
    WHERE smp.tenant_id = p_tenant_id
  ),
  enriched AS (
    SELECT
      c.*,
      c.cls->>'pipeline_kind'        AS pipeline_kind,
      c.cls->>'funil_canonico'       AS funil_canonico,
      c.cls->>'etapa_canonica'       AS etapa_canonica,
      c.cls->>'consultor_match_nome' AS consultor_match_nome,
      pf.id   AS funil_existente_id,
      pe.id   AS etapa_existente_id,
      cons.id AS consultor_existente_id,
      esc.id  AS consultor_escritorio_id
    FROM classified c
    LEFT JOIN public.projeto_funis pf
      ON pf.tenant_id = p_tenant_id
     AND lower(unaccent(pf.nome)) = lower(unaccent(c.cls->>'funil_canonico'))
    LEFT JOIN public.projeto_etapas pe
      ON pe.funil_id = pf.id
     AND lower(unaccent(pe.nome)) = lower(unaccent(c.cls->>'etapa_canonica'))
    LEFT JOIN public.consultores cons
      ON cons.tenant_id = p_tenant_id
     AND cons.ativo = true
     AND lower(unaccent(cons.nome)) = lower(unaccent(c.cls->>'consultor_match_nome'))
    LEFT JOIN public.consultores esc
      ON esc.tenant_id = p_tenant_id
     AND esc.ativo = true
     AND lower(unaccent(esc.nome)) = 'consultor escritorio'
  )
  SELECT jsonb_build_object(
    'tenant_id', p_tenant_id,
    'total_sm_records', (SELECT count(*) FROM enriched),
    'por_pipeline_kind', (
      SELECT jsonb_object_agg(pipeline_kind, qtd)
      FROM (
        SELECT pipeline_kind, count(*) AS qtd
        FROM enriched GROUP BY pipeline_kind
      ) s
    ),
    'comercial_por_etapa', (
      SELECT jsonb_object_agg(etapa_canonica, qtd)
      FROM (
        SELECT etapa_canonica, count(*) AS qtd
        FROM enriched
        WHERE pipeline_kind = 'commercial'
        GROUP BY etapa_canonica
      ) s
    ),
    'pendencias_funil_inexistente', (
      SELECT count(*) FROM enriched
      WHERE pipeline_kind IN ('commercial','technical')
        AND funil_existente_id IS NULL
    ),
    'pendencias_etapa_inexistente', (
      SELECT count(*) FROM enriched
      WHERE pipeline_kind IN ('commercial','technical')
        AND funil_existente_id IS NOT NULL
        AND etapa_existente_id IS NULL
    ),
    'responsaveis_sem_consultor_match', (
      SELECT jsonb_object_agg(consultor_match_nome, qtd)
      FROM (
        SELECT consultor_match_nome, count(*) AS qtd
        FROM enriched
        WHERE pipeline_kind = 'responsible_only'
          AND consultor_existente_id IS NULL
        GROUP BY consultor_match_nome
      ) s
    ),
    'consultor_escritorio_existe', (
      SELECT bool_or(consultor_escritorio_id IS NOT NULL) FROM enriched
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;