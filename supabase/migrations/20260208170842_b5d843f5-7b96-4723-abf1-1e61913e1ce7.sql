
-- Remover materialized views da API pública (PostgREST)
-- Mover para schema privado acessível apenas via funções SECURITY DEFINER

-- Revogar acesso direto às views via API
ALTER MATERIALIZED VIEW mv_leads_mensal SET SCHEMA extensions;
ALTER MATERIALIZED VIEW mv_leads_por_estado SET SCHEMA extensions;
ALTER MATERIALIZED VIEW mv_vendedor_performance SET SCHEMA extensions;
ALTER MATERIALIZED VIEW mv_pipeline_stats SET SCHEMA extensions;
ALTER MATERIALIZED VIEW mv_financeiro_resumo SET SCHEMA extensions;

-- Criar funções RPC seguras para acessar os dados

-- 1) Stats mensais
CREATE OR REPLACE FUNCTION public.get_dashboard_leads_mensal()
RETURNS TABLE(
  mes date,
  total_leads bigint,
  total_kwh bigint,
  media_consumo numeric,
  estados_unicos bigint,
  vendedores_ativos bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT mes, total_leads, total_kwh, media_consumo, estados_unicos, vendedores_ativos
  FROM extensions.mv_leads_mensal
  ORDER BY mes DESC;
$$;

-- 2) Leads por estado
CREATE OR REPLACE FUNCTION public.get_dashboard_leads_estado()
RETURNS TABLE(
  estado text,
  total_leads bigint,
  total_kwh bigint,
  media_consumo numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT estado, total_leads, total_kwh, media_consumo
  FROM extensions.mv_leads_por_estado
  ORDER BY total_leads DESC;
$$;

-- 3) Performance vendedor
CREATE OR REPLACE FUNCTION public.get_dashboard_vendedor_performance()
RETURNS TABLE(
  vendedor text,
  total_leads bigint,
  total_kwh bigint,
  leads_com_status bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT vendedor, total_leads, total_kwh, leads_com_status
  FROM extensions.mv_vendedor_performance
  ORDER BY total_leads DESC
  LIMIT 10;
$$;

-- 4) Pipeline stats
CREATE OR REPLACE FUNCTION public.get_dashboard_pipeline()
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
SET search_path = public
AS $$
  SELECT status_id, status_nome, status_cor, status_ordem, total_leads, total_kwh
  FROM extensions.mv_pipeline_stats
  ORDER BY status_ordem;
$$;

-- 5) Resumo financeiro
CREATE OR REPLACE FUNCTION public.get_dashboard_financeiro()
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
SET search_path = public
AS $$
  SELECT parcelas_pendentes, parcelas_atrasadas, parcelas_pagas,
         valor_pendente, valor_atrasado, valor_pago, atualizado_em
  FROM extensions.mv_financeiro_resumo;
$$;

-- Atualizar refresh function para novo schema
CREATE OR REPLACE FUNCTION public.refresh_dashboard_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY extensions.mv_leads_mensal;
  REFRESH MATERIALIZED VIEW CONCURRENTLY extensions.mv_leads_por_estado;
  REFRESH MATERIALIZED VIEW CONCURRENTLY extensions.mv_vendedor_performance;
  REFRESH MATERIALIZED VIEW CONCURRENTLY extensions.mv_pipeline_stats;
  REFRESH MATERIALIZED VIEW extensions.mv_financeiro_resumo;
END;
$$;
