-- FIX: Add deleted_at IS NULL filter to dashboard RPCs + find_leads_by_phone
-- Must DROP first due to return type mismatch on get_dashboard_leads_mensal_v2

DROP FUNCTION IF EXISTS public.get_dashboard_leads_mensal_v2();
DROP FUNCTION IF EXISTS public.get_dashboard_leads_estado_v2();
DROP FUNCTION IF EXISTS public.get_dashboard_consultor_performance_v2();
DROP FUNCTION IF EXISTS public.get_dashboard_pipeline_v2();

-- 1) get_dashboard_leads_mensal_v2
CREATE FUNCTION public.get_dashboard_leads_mensal_v2()
RETURNS TABLE(
  mes date,
  total_leads bigint,
  total_kwh bigint,
  media_consumo numeric,
  estados_unicos bigint,
  consultores_ativos bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    date_trunc('month', created_at)::date AS mes,
    count(*) AS total_leads,
    COALESCE(sum(media_consumo), 0)::bigint AS total_kwh,
    round(avg(media_consumo)) AS media_consumo,
    count(DISTINCT estado) AS estados_unicos,
    count(DISTINCT consultor) AS consultores_ativos
  FROM leads
  WHERE tenant_id = get_user_tenant_id()
    AND deleted_at IS NULL
    AND created_at >= (now() - interval '1 year')
  GROUP BY date_trunc('month', created_at)
  ORDER BY date_trunc('month', created_at)::date DESC;
$$;

-- 2) get_dashboard_leads_estado_v2
CREATE FUNCTION public.get_dashboard_leads_estado_v2()
RETURNS TABLE(
  estado text,
  total_leads bigint,
  total_kwh bigint,
  media_consumo numeric
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    estado,
    count(*) AS total_leads,
    COALESCE(sum(media_consumo), 0)::bigint AS total_kwh,
    round(avg(media_consumo)) AS media_consumo
  FROM leads
  WHERE tenant_id = get_user_tenant_id()
    AND deleted_at IS NULL
  GROUP BY estado
  ORDER BY count(*) DESC;
$$;

-- 3) get_dashboard_consultor_performance_v2
CREATE FUNCTION public.get_dashboard_consultor_performance_v2()
RETURNS TABLE(
  consultor text,
  total_leads bigint,
  total_kwh bigint,
  leads_com_status bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(consultor, 'Admin') AS consultor,
    count(*) AS total_leads,
    COALESCE(sum(media_consumo), 0)::bigint AS total_kwh,
    count(CASE WHEN status_id IS NOT NULL THEN 1 END) AS leads_com_status
  FROM leads
  WHERE tenant_id = get_user_tenant_id()
    AND deleted_at IS NULL
    AND created_at >= (now() - interval '6 months')
  GROUP BY COALESCE(consultor, 'Admin')
  ORDER BY count(*) DESC
  LIMIT 10;
$$;

-- 4) get_dashboard_pipeline_v2
CREATE FUNCTION public.get_dashboard_pipeline_v2()
RETURNS TABLE(
  status_id uuid,
  status_nome text,
  status_cor text,
  status_ordem integer,
  total_leads bigint,
  total_kwh bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ls.id AS status_id,
    ls.nome AS status_nome,
    ls.cor AS status_cor,
    ls.ordem AS status_ordem,
    count(l.id) AS total_leads,
    COALESCE(sum(l.media_consumo), 0)::bigint AS total_kwh
  FROM lead_status ls
  LEFT JOIN leads l ON l.status_id = ls.id
    AND l.tenant_id = get_user_tenant_id()
    AND l.deleted_at IS NULL
  WHERE ls.tenant_id = get_user_tenant_id()
  GROUP BY ls.id, ls.nome, ls.cor, ls.ordem
  ORDER BY ls.ordem;
$$;

-- 5) find_leads_by_phone — exclude soft-deleted
CREATE OR REPLACE FUNCTION public.find_leads_by_phone(_telefone text)
RETURNS TABLE(
  id uuid,
  lead_code text,
  nome text,
  telefone text,
  telefone_normalized text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized text;
  _tenant_id uuid;
BEGIN
  normalized := regexp_replace(_telefone, '[^0-9]', '', 'g');
  _tenant_id := get_user_tenant_id();
  IF _tenant_id IS NULL THEN RETURN; END IF;
  
  RETURN QUERY
  SELECT l.id, l.lead_code, l.nome, l.telefone, l.telefone_normalized, l.created_at, l.updated_at
  FROM leads l
  WHERE l.tenant_id = _tenant_id
    AND l.deleted_at IS NULL
    AND (l.telefone_normalized = normalized
      OR regexp_replace(l.telefone, '[^0-9]', '', 'g') = normalized)
  ORDER BY l.created_at DESC;
END;
$$;