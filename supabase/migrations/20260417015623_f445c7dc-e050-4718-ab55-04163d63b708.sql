-- Atualiza backfill_projetos_funil_etapa para também ignorar funis financeiros
-- (Pagamento/Financeiro/Cobrança/Recebimento/Faturamento/Financiamento).
-- Esses funis são dimensão paralela ao pipeline comercial/operacional e não devem
-- gerar alocação canônica de funil_id/etapa_id em projetos.

CREATE OR REPLACE FUNCTION public.backfill_projetos_funil_etapa(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sm_matched int := 0;
BEGIN
  WITH
  funis_consultor AS (
    SELECT pf.id
    FROM projeto_funis pf
    JOIN projeto_etapas pe ON pe.funil_id = pf.id
    LEFT JOIN consultores c
      ON c.tenant_id = pf.tenant_id
     AND lower(btrim(c.nome)) = lower(btrim(pe.nome))
    WHERE pf.tenant_id = p_tenant_id
    GROUP BY pf.id
    HAVING count(*) > 0
       AND count(c.id)::numeric / count(*)::numeric >= 0.5
  ),
  funis_financeiros AS (
    SELECT id
    FROM projeto_funis
    WHERE tenant_id = p_tenant_id
      AND nome ~* '(pagamento|financeiro|cobran[çc]a|recebimento|faturamento|financiamento)'
  ),
  sm_norm AS (
    SELECT
      smp.sm_project_id,
      smp.lead_id,
      CASE
        WHEN lower(btrim(smp.sm_funnel_name)) = 'compesação'        THEN 'Compensação'
        WHEN lower(btrim(smp.sm_funnel_name)) = 'compesação aceita' THEN 'Compensação aceita'
        ELSE btrim(smp.sm_funnel_name)
      END AS funnel_name,
      CASE
        WHEN lower(btrim(smp.sm_stage_name)) = 'compesação'        THEN 'Compensação'
        WHEN lower(btrim(smp.sm_stage_name)) = 'compesação aceita' THEN 'Compensação aceita'
        ELSE btrim(smp.sm_stage_name)
      END AS stage_name
    FROM solar_market_projects smp
    WHERE smp.tenant_id = p_tenant_id
      AND smp.sm_funnel_name IS NOT NULL
      AND smp.sm_stage_name IS NOT NULL
      AND smp.sm_funnel_name !~* '(pagamento|financeiro|cobran[çc]a|recebimento|faturamento|financiamento)'
  ),
  matched AS (
    UPDATE projetos p
    SET funil_id = pe.funil_id, etapa_id = pe.id
    FROM sm_norm s
    JOIN projeto_funis pf
      ON pf.tenant_id = p_tenant_id
     AND lower(btrim(pf.nome)) = lower(s.funnel_name)
    JOIN projeto_etapas pe
      ON pe.funil_id = pf.id
     AND lower(btrim(pe.nome)) = lower(s.stage_name)
    WHERE p.tenant_id = p_tenant_id
      AND p.import_source = 'solar_market'
      AND (p.funil_id IS NULL OR p.etapa_id IS NULL)
      AND pf.id NOT IN (SELECT id FROM funis_consultor)
      AND pf.id NOT IN (SELECT id FROM funis_financeiros)
      AND (
        (s.lead_id IS NOT NULL AND s.lead_id = p.lead_id)
        OR (p.snapshot->>'sm_project_id' = s.sm_project_id::text)
      )
    RETURNING p.id
  )
  SELECT count(*) INTO v_sm_matched FROM matched;

  RETURN jsonb_build_object(
    'sm_matched', v_sm_matched,
    'sm_default', 0,
    'native_default', 0,
    'total', v_sm_matched
  );
END;
$function$;