
-- =============================================
-- MATERIALIZED VIEWS PARA DASHBOARDS ESCALÁVEIS
-- =============================================

-- 1) Stats mensais de leads (últimos 12 meses)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_leads_mensal AS
SELECT
  date_trunc('month', created_at)::date AS mes,
  COUNT(*) AS total_leads,
  SUM(media_consumo) AS total_kwh,
  ROUND(AVG(media_consumo)) AS media_consumo,
  COUNT(DISTINCT estado) AS estados_unicos,
  COUNT(DISTINCT vendedor) AS vendedores_ativos
FROM leads
WHERE created_at >= (now() - interval '12 months')
GROUP BY date_trunc('month', created_at)
ORDER BY mes DESC;

-- Índice para busca rápida
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_leads_mensal_mes ON mv_leads_mensal (mes);

-- 2) Leads por estado (distribuição geográfica)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_leads_por_estado AS
SELECT
  estado,
  COUNT(*) AS total_leads,
  SUM(media_consumo) AS total_kwh,
  ROUND(AVG(media_consumo)) AS media_consumo
FROM leads
GROUP BY estado
ORDER BY total_leads DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_leads_estado ON mv_leads_por_estado (estado);

-- 3) Performance por vendedor
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_vendedor_performance AS
SELECT
  COALESCE(l.vendedor, 'Admin') AS vendedor,
  COUNT(*) AS total_leads,
  SUM(l.media_consumo) AS total_kwh,
  COUNT(CASE WHEN l.status_id IS NOT NULL THEN 1 END) AS leads_com_status,
  date_trunc('month', now())::date AS periodo
FROM leads l
WHERE l.created_at >= (now() - interval '6 months')
GROUP BY COALESCE(l.vendedor, 'Admin')
ORDER BY total_leads DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_vendedor_perf ON mv_vendedor_performance (vendedor);

-- 4) Pipeline / Funil de vendas
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_pipeline_stats AS
SELECT
  ls.id AS status_id,
  ls.nome AS status_nome,
  ls.cor AS status_cor,
  ls.ordem AS status_ordem,
  COUNT(l.id) AS total_leads,
  SUM(l.media_consumo) AS total_kwh
FROM lead_status ls
LEFT JOIN leads l ON l.status_id = ls.id
GROUP BY ls.id, ls.nome, ls.cor, ls.ordem
ORDER BY ls.ordem;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_pipeline ON mv_pipeline_stats (status_id);

-- 5) Resumo financeiro (parcelas)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_financeiro_resumo AS
SELECT
  COUNT(*) FILTER (WHERE status = 'pendente') AS parcelas_pendentes,
  COUNT(*) FILTER (WHERE status = 'atrasada') AS parcelas_atrasadas,
  COUNT(*) FILTER (WHERE status = 'paga') AS parcelas_pagas,
  COALESCE(SUM(valor) FILTER (WHERE status = 'pendente'), 0) AS valor_pendente,
  COALESCE(SUM(valor) FILTER (WHERE status = 'atrasada'), 0) AS valor_atrasado,
  COALESCE(SUM(valor) FILTER (WHERE status = 'paga'), 0) AS valor_pago,
  now() AS atualizado_em
FROM parcelas;

-- 6) Função para refresh de todas as materialized views
CREATE OR REPLACE FUNCTION public.refresh_dashboard_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_leads_mensal;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_leads_por_estado;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_vendedor_performance;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_pipeline_stats;
  REFRESH MATERIALIZED VIEW mv_financeiro_resumo;
END;
$$;

-- Permissões: apenas roles admin podem ler as views
-- (RLS não se aplica a materialized views, controlamos via grants)
GRANT SELECT ON mv_leads_mensal TO authenticated;
GRANT SELECT ON mv_leads_por_estado TO authenticated;
GRANT SELECT ON mv_vendedor_performance TO authenticated;
GRANT SELECT ON mv_pipeline_stats TO authenticated;
GRANT SELECT ON mv_financeiro_resumo TO authenticated;
