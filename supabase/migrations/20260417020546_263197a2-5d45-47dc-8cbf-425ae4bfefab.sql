
-- ============================================================
-- ONDA 1 — Convergência SolarMarket → CRM nativo
-- Escopos: 2 (classificador) + 3 (estrutura) + 4 (dry-run)
-- ============================================================

-- 1) Extensão unaccent para match acento-insensitive
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2) Coluna canônica de vínculo
ALTER TABLE public.projetos
  ADD COLUMN IF NOT EXISTS sm_project_id bigint;

CREATE UNIQUE INDEX IF NOT EXISTS projetos_tenant_sm_project_id_key
  ON public.projetos (tenant_id, sm_project_id)
  WHERE sm_project_id IS NOT NULL;

COMMENT ON COLUMN public.projetos.sm_project_id IS
  'Chave canônica de vínculo com solar_market_projects.sm_project_id. Único por tenant.';

-- 3) Classificador canônico — traduz SM → modelo nativo
-- Retorna estrutura única consumida tanto pelo dry-run quanto pelo apply.
CREATE OR REPLACE FUNCTION public.sm_classify_funnel_stage(
  p_tenant_id uuid,
  p_funnel_name text,
  p_stage_name text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_funnel_norm text;
  v_stage_norm text;
  v_pipeline_kind text;
  v_funil_canonico text;
  v_etapa_canonica text;
  v_consultor_match_nome text;
  v_motivo text;
BEGIN
  v_funnel_norm := btrim(coalesce(p_funnel_name, ''));
  v_stage_norm  := btrim(coalesce(p_stage_name, ''));

  -- Sem funil de origem → não classificável (sem fallback genérico)
  IF v_funnel_norm = '' THEN
    RETURN jsonb_build_object(
      'pipeline_kind', 'unmapped',
      'funil_canonico', NULL,
      'etapa_canonica', NULL,
      'consultor_match_nome', NULL,
      'deve_ignorar_pipeline', true,
      'motivo_classificacao', 'sm_funnel_name ausente'
    );
  END IF;

  -- Normalização leve de typos conhecidos da origem
  IF lower(v_funnel_norm) = 'compesação' THEN v_funnel_norm := 'Compensação'; END IF;
  IF lower(v_funnel_norm) = 'compesação aceita' THEN v_funnel_norm := 'Compensação aceita'; END IF;
  IF lower(v_stage_norm)  = 'compesação' THEN v_stage_norm := 'Compensação'; END IF;
  IF lower(v_stage_norm)  = 'compesação aceita' THEN v_stage_norm := 'Compensação aceita'; END IF;

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

  -- Funis financeiros → dimensão paralela (não pipeline principal)
  IF v_funnel_norm ~* '(pagamento|financeiro|cobran[çc]a|recebimento|faturamento|financiamento)' THEN
    RETURN jsonb_build_object(
      'pipeline_kind', 'financial_dimension',
      'funil_canonico', NULL,
      'etapa_canonica', NULL,
      'consultor_match_nome', NULL,
      'deve_ignorar_pipeline', true,
      'motivo_classificacao', 'funil financeiro → dimensão paralela'
    );
  END IF;

  -- LEAD → Comercial (canonização explícita)
  IF lower(v_funnel_norm) = 'lead' THEN
    v_funil_canonico := 'Comercial';
    v_pipeline_kind := 'commercial';
    v_etapa_canonica := CASE
      WHEN v_stage_norm = '' THEN NULL
      ELSE v_stage_norm
    END;
    v_motivo := 'LEAD traduzido para Comercial';
  ELSE
    -- Demais funis técnicos/operacionais: passthrough do nome
    v_funil_canonico := v_funnel_norm;
    v_etapa_canonica := NULLIF(v_stage_norm, '');
    v_pipeline_kind := 'technical';
    v_motivo := 'funil técnico/operacional passthrough';
  END IF;

  -- Sem etapa → ainda assim mapeável a funil, mas sinaliza pendência de etapa
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
$$;

-- 4) Dry-run da migração — relatório agregado, ZERO writes
CREATE OR REPLACE FUNCTION public.sm_migration_dry_run(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
      public.sm_classify_funnel_stage(p_tenant_id, smp.sm_funnel_name, smp.sm_stage_name) AS cls
    FROM public.solar_market_projects smp
    WHERE smp.tenant_id = p_tenant_id
  ),
  enriched AS (
    SELECT
      c.*,
      c.cls->>'pipeline_kind' AS pipeline_kind,
      c.cls->>'funil_canonico' AS funil_canonico,
      c.cls->>'etapa_canonica' AS etapa_canonica,
      c.cls->>'consultor_match_nome' AS consultor_match_nome,
      pf.id AS funil_existente_id,
      pe.id AS etapa_existente_id,
      cons.id AS consultor_existente_id
    FROM classified c
    LEFT JOIN public.projeto_funis pf
      ON pf.tenant_id = p_tenant_id
     AND lower(btrim(pf.nome)) = lower(c.cls->>'funil_canonico')
    LEFT JOIN public.projeto_etapas pe
      ON pe.tenant_id = p_tenant_id
     AND pe.funil_id = pf.id
     AND lower(btrim(pe.nome)) = lower(c.cls->>'etapa_canonica')
    LEFT JOIN public.consultores cons
      ON cons.tenant_id = p_tenant_id
     AND cons.ativo = true
     AND unaccent(lower(btrim(cons.nome))) = unaccent(lower(btrim(c.cls->>'consultor_match_nome')))
  )
  SELECT jsonb_build_object(
    'tenant_id', p_tenant_id,
    'total_sm_projects', count(*),
    'por_pipeline_kind', (
      SELECT jsonb_object_agg(pipeline_kind, qtd)
      FROM (SELECT pipeline_kind, count(*) qtd FROM enriched GROUP BY pipeline_kind) s
    ),
    'por_funil_canonico', (
      SELECT jsonb_object_agg(coalesce(funil_canonico, '_sem_funil_'), qtd)
      FROM (SELECT funil_canonico, count(*) qtd FROM enriched WHERE pipeline_kind IN ('commercial','technical') GROUP BY funil_canonico) s
    ),
    'funis_a_criar', (
      SELECT coalesce(jsonb_agg(DISTINCT funil_canonico), '[]'::jsonb)
      FROM enriched
      WHERE pipeline_kind IN ('commercial','technical')
        AND funil_canonico IS NOT NULL
        AND funil_existente_id IS NULL
    ),
    'etapas_a_criar', (
      SELECT coalesce(jsonb_agg(DISTINCT jsonb_build_object('funil', funil_canonico, 'etapa', etapa_canonica)), '[]'::jsonb)
      FROM enriched
      WHERE pipeline_kind IN ('commercial','technical')
        AND etapa_canonica IS NOT NULL
        AND etapa_existente_id IS NULL
    ),
    'consultores_nao_mapeados', (
      SELECT coalesce(jsonb_agg(DISTINCT consultor_match_nome), '[]'::jsonb)
      FROM enriched
      WHERE pipeline_kind = 'responsible_only'
        AND consultor_match_nome IS NOT NULL
        AND consultor_existente_id IS NULL
    ),
    'pendencias', jsonb_build_object(
      'sem_classificacao', (SELECT count(*) FROM enriched WHERE pipeline_kind = 'unmapped'),
      'dimensao_financeira', (SELECT count(*) FROM enriched WHERE pipeline_kind = 'financial_dimension'),
      'apenas_responsavel', (SELECT count(*) FROM enriched WHERE pipeline_kind = 'responsible_only'),
      'pipeline_sem_etapa', (SELECT count(*) FROM enriched WHERE pipeline_kind IN ('commercial','technical') AND etapa_canonica IS NULL)
    ),
    'projetos_a_inserir', (
      SELECT count(*) FROM enriched
      WHERE pipeline_kind IN ('commercial','technical')
        AND funil_canonico IS NOT NULL
    ),
    'amostra_sem_classificacao', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('sm_project_id', sm_project_id, 'funnel', sm_funnel_name, 'stage', sm_stage_name)), '[]'::jsonb)
      FROM (SELECT sm_project_id, sm_funnel_name, sm_stage_name FROM enriched WHERE pipeline_kind='unmapped' LIMIT 10) s
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;
