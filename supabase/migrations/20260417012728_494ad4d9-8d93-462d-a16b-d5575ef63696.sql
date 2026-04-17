-- Substitui backfill_projetos_funil_etapa removendo:
-- 1) hardcode de "Engenharia"
-- 2) fallback técnico que joga tudo em Engenharia/etapa1
-- 3) alocação cega que ignora a exclusão de funis de consultor (Vendedores)
-- Adiciona:
-- - normalização leve de typos (Compesação → Compensação)
-- - exclusão dinâmica de funis de consultor (heurística >=50% etapas == nome de consultor)
-- - tenant isolation estrito
-- - idempotência (só preenche quando NULL)
-- - retorno estruturado preservado (total, sm_matched)

CREATE OR REPLACE FUNCTION public.backfill_projetos_funil_etapa(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sm_matched int := 0;
BEGIN
  -- Match determinístico por tenant + nome de funil/etapa, com:
  --   * normalização de typos conhecidos (Compesação → Compensação)
  --   * etapa obrigatoriamente pertencente ao funil
  --   * exclusão de funis cujas etapas correspondem a nomes de consultores (Vendedores)
  --   * idempotência: só atualiza projetos com funil_id OU etapa_id NULL
  --   * sem overwrite quando já está vinculado corretamente
  WITH
  -- Funis de consultor: >=50% das etapas batem (case-insensitive) com algum consultor do tenant
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
      AND (
        (s.lead_id IS NOT NULL AND s.lead_id = p.lead_id)
        OR (p.snapshot->>'sm_project_id' = s.sm_project_id::text)
      )
    RETURNING p.id
  )
  SELECT count(*) INTO v_sm_matched FROM matched;

  -- Sem fallback. Projetos sem match canônico permanecem com funil_id/etapa_id NULL,
  -- preservando o critério de "só alocar quando há match confiável".

  RETURN jsonb_build_object(
    'sm_matched', v_sm_matched,
    'sm_default', 0,
    'native_default', 0,
    'total', v_sm_matched
  );
END;
$function$;