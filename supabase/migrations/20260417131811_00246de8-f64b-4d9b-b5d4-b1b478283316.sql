
-- =============================================================================
-- Fase A+B Consolidada: Migration canônica para classificação e dry-run SM
-- =============================================================================

-- 1) Índice único parcial em projetos(tenant_id, sm_project_id)
--    Garante idempotência da migração (1 sm_project_id = 1 projeto nativo por tenant)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_projetos_tenant_sm_project_id
  ON public.projetos (tenant_id, sm_project_id)
  WHERE sm_project_id IS NOT NULL;

-- 2) Normalização canônica de funis e etapas (idempotente, por tenant)
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Renomeia funil "Compesação" -> "Compensação" em todos os tenants
  UPDATE public.projeto_funis
     SET nome = 'Compensação'
   WHERE lower(trim(nome)) = 'compesação';

  -- Renomeia etapas "Compesação enviada/aceita" -> "Compensação enviada/aceita"
  UPDATE public.projeto_etapas
     SET nome = 'Compensação enviada'
   WHERE lower(trim(nome)) = 'compesação enviada';

  UPDATE public.projeto_etapas
     SET nome = 'Compensação aceita'
   WHERE lower(trim(nome)) = 'compesação aceita';

  -- Desativa funil "Pagamento" (financeiro fora do pipeline principal)
  UPDATE public.projeto_funis
     SET ativo = false
   WHERE lower(trim(nome)) = 'pagamento';

  -- Garante etapa "Perdido" em todo funil Comercial (categoria=perdido)
  FOR r IN
    SELECT id, tenant_id
      FROM public.projeto_funis
     WHERE lower(trim(nome)) = 'comercial'
       AND ativo = true
  LOOP
    INSERT INTO public.projeto_etapas (tenant_id, funil_id, nome, ordem, categoria, cor)
    SELECT r.tenant_id, r.id, 'Perdido',
           COALESCE((SELECT MAX(ordem) + 1 FROM public.projeto_etapas WHERE funil_id = r.id), 99),
           'perdido', '#ef4444'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.projeto_etapas
       WHERE funil_id = r.id
         AND lower(trim(nome)) = 'perdido'
    );
  END LOOP;
END $$;

-- 3) RPC: dry_run_sm_migration
--    Retorna distribuição completa SEM escrever nada.
--    Aplica regra canônica de elegibilidade: EXISTS em solar_market_proposals.
CREATE OR REPLACE FUNCTION public.dry_run_sm_migration(_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_sm_projects   integer;
  total_eligible      integer;
  total_classified    integer;
  total_pending       integer;
  total_already_migrated integer;
  total_to_create     integer;
  total_to_update     integer;
  dist_by_kind        jsonb;
  dist_by_funnel      jsonb;
  dist_by_etapa       jsonb;
  pending_samples     jsonb;
  unresolved_funnels  jsonb;
BEGIN
  -- Total SM projects
  SELECT count(*) INTO total_sm_projects
    FROM public.solar_market_projects
   WHERE tenant_id = _tenant_id;

  -- Elegíveis: têm proposta no SM
  SELECT count(*) INTO total_eligible
    FROM public.solar_market_projects sp
   WHERE sp.tenant_id = _tenant_id
     AND EXISTS (
       SELECT 1 FROM public.solar_market_proposals pr
        WHERE pr.tenant_id = _tenant_id
          AND pr.sm_project_id = sp.sm_project_id
     );

  -- Já classificados
  SELECT count(*) INTO total_classified
    FROM public.sm_project_classification c
    JOIN public.solar_market_projects sp ON sp.id = c.sm_project_id
   WHERE c.tenant_id = _tenant_id
     AND EXISTS (
       SELECT 1 FROM public.solar_market_proposals pr
        WHERE pr.tenant_id = _tenant_id
          AND pr.sm_project_id = sp.sm_project_id
     );

  -- Elegíveis sem classificação
  total_pending := total_eligible - total_classified;

  -- Já migrados (existe projeto nativo com mesmo sm_project_id)
  SELECT count(*) INTO total_already_migrated
    FROM public.solar_market_projects sp
    JOIN public.projetos p
      ON p.tenant_id = sp.tenant_id
     AND p.sm_project_id = sp.sm_project_id
   WHERE sp.tenant_id = _tenant_id
     AND EXISTS (
       SELECT 1 FROM public.solar_market_proposals pr
        WHERE pr.tenant_id = _tenant_id
          AND pr.sm_project_id = sp.sm_project_id
     );

  -- A criar (elegível classificado, sem projeto nativo)
  SELECT count(*) INTO total_to_create
    FROM public.sm_project_classification c
    JOIN public.solar_market_projects sp ON sp.id = c.sm_project_id
   WHERE c.tenant_id = _tenant_id
     AND EXISTS (
       SELECT 1 FROM public.solar_market_proposals pr
        WHERE pr.tenant_id = _tenant_id
          AND pr.sm_project_id = sp.sm_project_id
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.projetos p
        WHERE p.tenant_id = sp.tenant_id
          AND p.sm_project_id = sp.sm_project_id
     );

  total_to_update := total_already_migrated;

  -- Distribuição por pipeline_kind
  SELECT COALESCE(
    jsonb_object_agg(pipeline_kind, qtd),
    '{}'::jsonb
  ) INTO dist_by_kind
  FROM (
    SELECT c.pipeline_kind::text, count(*)::int AS qtd
      FROM public.sm_project_classification c
      JOIN public.solar_market_projects sp ON sp.id = c.sm_project_id
     WHERE c.tenant_id = _tenant_id
       AND EXISTS (
         SELECT 1 FROM public.solar_market_proposals pr
          WHERE pr.tenant_id = _tenant_id
            AND pr.sm_project_id = sp.sm_project_id
       )
     GROUP BY c.pipeline_kind
  ) t;

  -- Distribuição por funil destino
  SELECT COALESCE(
    jsonb_object_agg(funil_nome, qtd),
    '{}'::jsonb
  ) INTO dist_by_funnel
  FROM (
    SELECT COALESCE(pf.nome, '(sem funil)') AS funil_nome, count(*)::int AS qtd
      FROM public.sm_project_classification c
      JOIN public.solar_market_projects sp ON sp.id = c.sm_project_id
      LEFT JOIN public.projeto_funis pf ON pf.id = c.funil_destino_id
     WHERE c.tenant_id = _tenant_id
       AND EXISTS (
         SELECT 1 FROM public.solar_market_proposals pr
          WHERE pr.tenant_id = _tenant_id
            AND pr.sm_project_id = sp.sm_project_id
       )
     GROUP BY pf.nome
  ) t;

  -- Distribuição por etapa destino
  SELECT COALESCE(
    jsonb_object_agg(etapa_label, qtd),
    '{}'::jsonb
  ) INTO dist_by_etapa
  FROM (
    SELECT COALESCE(pf.nome, '?') || ' / ' || COALESCE(pe.nome, '(sem etapa)') AS etapa_label,
           count(*)::int AS qtd
      FROM public.sm_project_classification c
      JOIN public.solar_market_projects sp ON sp.id = c.sm_project_id
      LEFT JOIN public.projeto_funis pf ON pf.id = c.funil_destino_id
      LEFT JOIN public.projeto_etapas pe ON pe.id = c.etapa_destino_id
     WHERE c.tenant_id = _tenant_id
       AND EXISTS (
         SELECT 1 FROM public.solar_market_proposals pr
          WHERE pr.tenant_id = _tenant_id
            AND pr.sm_project_id = sp.sm_project_id
       )
     GROUP BY pf.nome, pe.nome
  ) t;

  -- Amostra de pendentes (elegíveis sem classificação)
  SELECT COALESCE(jsonb_agg(row_to_json(s)), '[]'::jsonb) INTO pending_samples
    FROM (
      SELECT sp.sm_project_id, sp.sm_funnel_name, sp.sm_stage_name, sp.customer_name
        FROM public.solar_market_projects sp
       WHERE sp.tenant_id = _tenant_id
         AND EXISTS (
           SELECT 1 FROM public.solar_market_proposals pr
            WHERE pr.tenant_id = _tenant_id
              AND pr.sm_project_id = sp.sm_project_id
         )
         AND NOT EXISTS (
           SELECT 1 FROM public.sm_project_classification c
            WHERE c.tenant_id = _tenant_id
              AND c.sm_project_id = sp.id
         )
       LIMIT 20
    ) s;

  -- Funis SM não resolvidos (sem match em funil nativo, sem cair em fallback intencional)
  SELECT COALESCE(jsonb_object_agg(funnel, qtd), '{}'::jsonb) INTO unresolved_funnels
    FROM (
      SELECT COALESCE(sp.sm_funnel_name, '(null)') AS funnel, count(*)::int AS qtd
        FROM public.solar_market_projects sp
        JOIN public.sm_project_classification c
          ON c.sm_project_id = sp.id AND c.tenant_id = sp.tenant_id
       WHERE sp.tenant_id = _tenant_id
         AND c.pipeline_kind = 'verificar_dados'
       GROUP BY sp.sm_funnel_name
    ) t;

  RETURN jsonb_build_object(
    'tenant_id', _tenant_id,
    'generated_at', now(),
    'total_sm_projects', total_sm_projects,
    'total_eligible', total_eligible,
    'total_classified', total_classified,
    'total_pending_classification', total_pending,
    'total_already_migrated', total_already_migrated,
    'total_to_create', total_to_create,
    'total_to_update', total_to_update,
    'distribution_by_kind', dist_by_kind,
    'distribution_by_funnel', dist_by_funnel,
    'distribution_by_etapa', dist_by_etapa,
    'unresolved_funnels', unresolved_funnels,
    'pending_samples', pending_samples
  );
END $$;

REVOKE ALL ON FUNCTION public.dry_run_sm_migration(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dry_run_sm_migration(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.dry_run_sm_migration(uuid) IS
'Dry-run da migração SolarMarket. Retorna distribuição por funil/etapa/kind, pendências e funis não resolvidos. NÃO escreve nada.';
