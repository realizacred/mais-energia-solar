CREATE OR REPLACE FUNCTION public.get_proposals_by_vendor(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
  v_since timestamptz;
  v_tenant_id uuid;
BEGIN
  v_tenant_id := current_tenant_id();
  IF v_tenant_id IS NULL THEN RETURN '[]'::jsonb; END IF;
  v_since := now() - (p_days || ' days')::interval;

  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) INTO v_result
  FROM (
    WITH base AS (
      SELECT
        pn.id,
        pn.status,
        COALESCE(
          pn.consultor_id,
          d.owner_id,
          pj.consultor_id,
          l.consultor_id,
          pn.created_by
        ) AS resolved_user_id,
        pv.valor_total
      FROM propostas_nativas pn
      LEFT JOIN proposta_versoes pv
        ON pv.proposta_id = pn.id
       AND pv.versao_numero = (
            SELECT MAX(pv2.versao_numero)
            FROM proposta_versoes pv2 WHERE pv2.proposta_id = pn.id
       )
      LEFT JOIN deals    d  ON d.id  = pn.deal_id
      LEFT JOIN projetos pj ON pj.id = pn.projeto_id
      LEFT JOIN leads    l  ON l.id  = pn.lead_id
      WHERE pn.tenant_id = v_tenant_id
        AND pn.created_at >= v_since
        AND pn.status != 'excluida'
    )
    SELECT
      COALESCE(pr.nome, 'Sem vendedor')      AS vendedor,
      b.resolved_user_id                     AS vendedor_id,
      COUNT(*)                               AS total,
      COUNT(*) FILTER (WHERE b.status = 'aceita')              AS aceitas,
      COUNT(*) FILTER (WHERE b.status IN ('enviada','vista'))  AS pendentes,
      COALESCE(SUM(b.valor_total) FILTER (WHERE b.status = 'aceita'), 0) AS valor_aceito,
      ROUND(
        CASE WHEN COUNT(*) > 0
          THEN (COUNT(*) FILTER (WHERE b.status = 'aceita')::numeric / COUNT(*)) * 100
          ELSE 0 END,
        1
      ) AS taxa_conversao
    FROM base b
    LEFT JOIN profiles pr ON pr.user_id = b.resolved_user_id
    GROUP BY pr.nome, b.resolved_user_id
    ORDER BY total DESC
  ) r;

  RETURN v_result;
END;
$function$;