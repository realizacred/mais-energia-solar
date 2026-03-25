
-- Update RPCs to use current_tenant_id() instead of p_tenant_id parameter

CREATE OR REPLACE FUNCTION public.get_proposal_funnel_metrics(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_tenant_id uuid;
  v_since timestamptz;
  v_total_geradas int; v_total_enviadas int; v_total_vistas int;
  v_total_aceitas int; v_total_recusadas int;
  v_avg_tempo_abertura interval; v_propostas_quentes int;
BEGIN
  v_tenant_id := current_tenant_id();
  IF v_tenant_id IS NULL THEN RETURN '{}'::jsonb; END IF;
  v_since := now() - (p_days || ' days')::interval;

  SELECT
    COUNT(*) FILTER (WHERE status NOT IN ('rascunho','excluida')),
    COUNT(*) FILTER (WHERE status IN ('enviada','vista','aceita','recusada')),
    COUNT(*) FILTER (WHERE status IN ('vista','aceita') OR primeiro_acesso_em IS NOT NULL),
    COUNT(*) FILTER (WHERE status = 'aceita'),
    COUNT(*) FILTER (WHERE status = 'recusada')
  INTO v_total_geradas, v_total_enviadas, v_total_vistas, v_total_aceitas, v_total_recusadas
  FROM propostas_nativas WHERE tenant_id = v_tenant_id AND created_at >= v_since;

  SELECT AVG(primeiro_acesso_em - enviada_at) INTO v_avg_tempo_abertura
  FROM propostas_nativas
  WHERE tenant_id = v_tenant_id AND created_at >= v_since
    AND primeiro_acesso_em IS NOT NULL AND enviada_at IS NOT NULL;

  SELECT COUNT(DISTINCT id) INTO v_propostas_quentes
  FROM propostas_nativas
  WHERE tenant_id = v_tenant_id AND created_at >= v_since
    AND total_aberturas >= 2
    AND status NOT IN ('aceita','recusada','cancelada','expirada','excluida');

  RETURN jsonb_build_object(
    'total_geradas', v_total_geradas, 'total_enviadas', v_total_enviadas,
    'total_vistas', v_total_vistas, 'total_aceitas', v_total_aceitas,
    'total_recusadas', v_total_recusadas,
    'taxa_visualizacao', CASE WHEN v_total_enviadas > 0 THEN ROUND((v_total_vistas::numeric / v_total_enviadas) * 100, 1) ELSE 0 END,
    'taxa_conversao', CASE WHEN v_total_geradas > 0 THEN ROUND((v_total_aceitas::numeric / v_total_geradas) * 100, 1) ELSE 0 END,
    'propostas_quentes', v_propostas_quentes,
    'avg_tempo_abertura_horas', CASE WHEN v_avg_tempo_abertura IS NOT NULL THEN ROUND(EXTRACT(EPOCH FROM v_avg_tempo_abertura) / 3600, 1) ELSE NULL END,
    'period_days', p_days
  );
END;
$$;

-- Drop old signature with p_tenant_id
DROP FUNCTION IF EXISTS public.get_proposal_funnel_metrics(uuid, integer);

CREATE OR REPLACE FUNCTION public.get_proposals_by_vendor(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_result jsonb; v_since timestamptz; v_tenant_id uuid;
BEGIN
  v_tenant_id := current_tenant_id();
  IF v_tenant_id IS NULL THEN RETURN '[]'::jsonb; END IF;
  v_since := now() - (p_days || ' days')::interval;
  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) INTO v_result
  FROM (
    SELECT pr.full_name as vendedor, pr.user_id as vendedor_id,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE pn.status = 'aceita') as aceitas,
      COUNT(*) FILTER (WHERE pn.status IN ('enviada','vista')) as pendentes,
      COALESCE(SUM(pv.valor_total) FILTER (WHERE pn.status = 'aceita'), 0) as valor_aceito,
      ROUND(CASE WHEN COUNT(*) > 0 THEN (COUNT(*) FILTER (WHERE pn.status = 'aceita')::numeric / COUNT(*)) * 100 ELSE 0 END, 1) as taxa_conversao
    FROM propostas_nativas pn
    LEFT JOIN proposta_versoes pv ON pv.proposta_id = pn.id
      AND pv.versao_numero = (SELECT MAX(pv2.versao_numero) FROM proposta_versoes pv2 WHERE pv2.proposta_id = pn.id)
    LEFT JOIN leads l ON l.id = pn.lead_id
    LEFT JOIN profiles pr ON pr.user_id = l.consultor_id
    WHERE pn.tenant_id = v_tenant_id AND pn.created_at >= v_since AND pn.status != 'excluida'
    GROUP BY pr.full_name, pr.user_id ORDER BY total DESC
  ) r;
  RETURN v_result;
END;
$$;

DROP FUNCTION IF EXISTS public.get_proposals_by_vendor(uuid, integer);

CREATE OR REPLACE FUNCTION public.get_hot_proposals(p_limit integer DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_result jsonb; v_tenant_id uuid;
BEGIN
  v_tenant_id := current_tenant_id();
  IF v_tenant_id IS NULL THEN RETURN '[]'::jsonb; END IF;
  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) INTO v_result
  FROM (
    SELECT pn.id, pn.titulo, pn.codigo, pn.status, pn.total_aberturas,
      pn.primeiro_acesso_em, pn.ultimo_acesso_em, pn.enviada_at,
      c.nome as cliente_nome, pv.valor_total, pv.potencia_kwp,
      pr.full_name as vendedor
    FROM propostas_nativas pn
    LEFT JOIN clientes c ON c.id = pn.cliente_id
    LEFT JOIN proposta_versoes pv ON pv.proposta_id = pn.id
      AND pv.versao_numero = (SELECT MAX(pv2.versao_numero) FROM proposta_versoes pv2 WHERE pv2.proposta_id = pn.id)
    LEFT JOIN leads l ON l.id = pn.lead_id
    LEFT JOIN profiles pr ON pr.user_id = l.consultor_id
    WHERE pn.tenant_id = v_tenant_id
      AND pn.total_aberturas >= 2
      AND pn.status NOT IN ('aceita','recusada','cancelada','expirada','excluida')
    ORDER BY pn.total_aberturas DESC, pn.ultimo_acesso_em DESC
    LIMIT p_limit
  ) r;
  RETURN v_result;
END;
$$;

DROP FUNCTION IF EXISTS public.get_hot_proposals(uuid, integer);
