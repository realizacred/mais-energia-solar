
-- ============================================================
-- P0 FIX: Cross-tenant dashboard leak + insecure RPCs
-- P1: Deprecate old MVs, add tenant-safe v2 RPCs
-- ============================================================

-- ── A) TENANT-SAFE v2 RPCs ──────────────────────────────────

-- 1) get_dashboard_leads_mensal_v2
CREATE OR REPLACE FUNCTION public.get_dashboard_leads_mensal_v2()
RETURNS TABLE(
  mes date,
  total_leads bigint,
  total_kwh bigint,
  media_consumo numeric,
  estados_unicos bigint,
  consultores_ativos bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    date_trunc('month', created_at)::date AS mes,
    count(*) AS total_leads,
    COALESCE(sum(media_consumo), 0) AS total_kwh,
    round(avg(media_consumo)) AS media_consumo,
    count(DISTINCT estado) AS estados_unicos,
    count(DISTINCT consultor) AS consultores_ativos
  FROM leads
  WHERE tenant_id = get_user_tenant_id()
    AND created_at >= (now() - interval '1 year')
  GROUP BY date_trunc('month', created_at)
  ORDER BY date_trunc('month', created_at)::date DESC;
$$;

-- 2) get_dashboard_leads_estado_v2
CREATE OR REPLACE FUNCTION public.get_dashboard_leads_estado_v2()
RETURNS TABLE(
  estado text,
  total_leads bigint,
  total_kwh bigint,
  media_consumo numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    estado,
    count(*) AS total_leads,
    COALESCE(sum(media_consumo), 0) AS total_kwh,
    round(avg(media_consumo)) AS media_consumo
  FROM leads
  WHERE tenant_id = get_user_tenant_id()
  GROUP BY estado
  ORDER BY count(*) DESC;
$$;

-- 3) get_dashboard_consultor_performance_v2
CREATE OR REPLACE FUNCTION public.get_dashboard_consultor_performance_v2()
RETURNS TABLE(
  consultor text,
  total_leads bigint,
  total_kwh bigint,
  leads_com_status bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    COALESCE(consultor, 'Admin') AS consultor,
    count(*) AS total_leads,
    COALESCE(sum(media_consumo), 0) AS total_kwh,
    count(CASE WHEN status_id IS NOT NULL THEN 1 END) AS leads_com_status
  FROM leads
  WHERE tenant_id = get_user_tenant_id()
    AND created_at >= (now() - interval '6 months')
  GROUP BY COALESCE(consultor, 'Admin')
  ORDER BY count(*) DESC
  LIMIT 10;
$$;

-- 4) get_dashboard_pipeline_v2
CREATE OR REPLACE FUNCTION public.get_dashboard_pipeline_v2()
RETURNS TABLE(
  status_id uuid,
  status_nome text,
  status_cor text,
  status_ordem integer,
  total_leads bigint,
  total_kwh bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    ls.id AS status_id,
    ls.nome AS status_nome,
    ls.cor AS status_cor,
    ls.ordem AS status_ordem,
    count(l.id) AS total_leads,
    COALESCE(sum(l.media_consumo), 0) AS total_kwh
  FROM lead_status ls
  LEFT JOIN leads l ON l.status_id = ls.id AND l.tenant_id = get_user_tenant_id()
  WHERE ls.tenant_id = get_user_tenant_id()
  GROUP BY ls.id, ls.nome, ls.cor, ls.ordem
  ORDER BY ls.ordem;
$$;

-- 5) get_dashboard_financeiro_v2
CREATE OR REPLACE FUNCTION public.get_dashboard_financeiro_v2()
RETURNS TABLE(
  parcelas_pendentes bigint,
  parcelas_atrasadas bigint,
  parcelas_pagas bigint,
  valor_pendente numeric,
  valor_atrasado numeric,
  valor_pago numeric,
  atualizado_em timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    count(*) FILTER (WHERE status = 'pendente') AS parcelas_pendentes,
    count(*) FILTER (WHERE status = 'atrasada') AS parcelas_atrasadas,
    count(*) FILTER (WHERE status = 'paga') AS parcelas_pagas,
    COALESCE(sum(valor) FILTER (WHERE status = 'pendente'), 0) AS valor_pendente,
    COALESCE(sum(valor) FILTER (WHERE status = 'atrasada'), 0) AS valor_atrasado,
    COALESCE(sum(valor) FILTER (WHERE status = 'paga'), 0) AS valor_pago,
    now() AS atualizado_em
  FROM parcelas
  WHERE tenant_id = get_user_tenant_id();
$$;

-- ── B) SECURE refresh_dashboard_views_v2 (super_admin only) ──

CREATE OR REPLACE FUNCTION public.refresh_dashboard_views_v2()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden: super_admin required for refresh_dashboard_views'
      USING ERRCODE = 'P0403';
  END IF;
  -- MVs are deprecated; v2 RPCs query tables directly.
  -- Kept for backward compat: refresh MVs if they still exist.
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY extensions.mv_leads_mensal;
    REFRESH MATERIALIZED VIEW CONCURRENTLY extensions.mv_leads_por_estado;
    REFRESH MATERIALIZED VIEW CONCURRENTLY extensions.mv_consultor_performance;
    REFRESH MATERIALIZED VIEW CONCURRENTLY extensions.mv_pipeline_stats;
    REFRESH MATERIALIZED VIEW extensions.mv_financeiro_resumo;
  EXCEPTION WHEN undefined_table THEN
    -- MVs already dropped — no-op
    NULL;
  END;
END;
$$;

-- ── C) GRANTS (v2 = authenticated only, NEVER anon) ──

REVOKE ALL ON FUNCTION public.get_dashboard_leads_mensal_v2() FROM anon;
REVOKE ALL ON FUNCTION public.get_dashboard_leads_estado_v2() FROM anon;
REVOKE ALL ON FUNCTION public.get_dashboard_consultor_performance_v2() FROM anon;
REVOKE ALL ON FUNCTION public.get_dashboard_pipeline_v2() FROM anon;
REVOKE ALL ON FUNCTION public.get_dashboard_financeiro_v2() FROM anon;
REVOKE ALL ON FUNCTION public.refresh_dashboard_views_v2() FROM anon;

GRANT EXECUTE ON FUNCTION public.get_dashboard_leads_mensal_v2() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_leads_estado_v2() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_consultor_performance_v2() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_pipeline_v2() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_financeiro_v2() TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_dashboard_views_v2() TO authenticated;

-- ── D) DEPRECATE old RPCs (add safety comments, keep for compat) ──

COMMENT ON FUNCTION public.get_dashboard_leads_mensal() IS 'DEPRECATED P0: Cross-tenant leak. Use get_dashboard_leads_mensal_v2(). Will be dropped in next release.';
COMMENT ON FUNCTION public.get_dashboard_leads_estado() IS 'DEPRECATED P0: Cross-tenant leak. Use get_dashboard_leads_estado_v2(). Will be dropped in next release.';
COMMENT ON FUNCTION public.get_dashboard_consultor_performance() IS 'DEPRECATED P0: Cross-tenant leak. Use get_dashboard_consultor_performance_v2(). Will be dropped in next release.';
COMMENT ON FUNCTION public.get_dashboard_pipeline() IS 'DEPRECATED P0: Cross-tenant leak. Use get_dashboard_pipeline_v2(). Will be dropped in next release.';
COMMENT ON FUNCTION public.get_dashboard_financeiro() IS 'DEPRECATED P0: Cross-tenant leak. Use get_dashboard_financeiro_v2(). Will be dropped in next release.';
COMMENT ON FUNCTION public.refresh_dashboard_views() IS 'DEPRECATED P0: No tenant filter. Use refresh_dashboard_views_v2(). Will be dropped in next release.';

-- ── E) DEPRECATE MVs (comments only — no drop yet) ──

COMMENT ON MATERIALIZED VIEW extensions.mv_leads_mensal IS 'DEPRECATED P0: No tenant_id filter — cross-tenant data. v2 RPCs query tables directly.';
COMMENT ON MATERIALIZED VIEW extensions.mv_leads_por_estado IS 'DEPRECATED P0: No tenant_id filter — cross-tenant data.';
COMMENT ON MATERIALIZED VIEW extensions.mv_consultor_performance IS 'DEPRECATED P0: No tenant_id filter — cross-tenant data.';
COMMENT ON MATERIALIZED VIEW extensions.mv_pipeline_stats IS 'DEPRECATED P0: No tenant_id filter — cross-tenant data.';
COMMENT ON MATERIALIZED VIEW extensions.mv_financeiro_resumo IS 'DEPRECATED P0: No tenant_id filter — cross-tenant data.';
