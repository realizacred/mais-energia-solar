
CREATE OR REPLACE FUNCTION public.proposal_list(p_limit int DEFAULT 200)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH tenant AS (
    SELECT current_tenant_id() AS tid
  ),
  latest_versao AS (
    SELECT DISTINCT ON (pv.proposta_id)
      pv.proposta_id,
      pv.potencia_kwp,
      pv.valor_total,
      pv.economia_mensal,
      pv.geracao_mensal,
      pv.payback_meses,
      pv.output_pdf_path,
      pv.gerado_em,
      pv.snapshot
    FROM proposta_versoes pv
    JOIN propostas_nativas pn ON pn.id = pv.proposta_id
    JOIN tenant t ON pn.tenant_id = t.tid
    WHERE pn.status != 'excluida'
    ORDER BY pv.proposta_id, pv.versao_numero DESC
  )
  SELECT coalesce(jsonb_agg(row_to_json(r)::jsonb ORDER BY r.created_at DESC), '[]'::jsonb)
  FROM (
    SELECT
      pn.id,
      coalesce(pn.titulo, pn.codigo, 'Proposta') AS nome,
      pn.status::text AS status,
      coalesce(c.nome, l.nome,
        lv.snapshot->>'clienteNome',
        lv.snapshot->>'cliente_nome') AS cliente_nome,
      coalesce(c.telefone, l.telefone) AS cliente_celular,
      coalesce(c.cidade, lv.snapshot->>'locCidade', lv.snapshot->>'loc_cidade') AS cliente_cidade,
      coalesce(c.estado, lv.snapshot->>'locEstado', lv.snapshot->>'loc_estado') AS cliente_estado,
      c.email AS cliente_email,
      lv.potencia_kwp,
      lv.valor_total AS preco_total,
      lv.economia_mensal,
      lv.geracao_mensal AS geracao_mensal_kwh,
      CASE WHEN lv.payback_meses IS NOT NULL AND lv.payback_meses > 0
           THEN round(lv.payback_meses::numeric / 12, 2)
           ELSE NULL END AS payback_anos,
      lv.output_pdf_path AS link_pdf,
      lv.gerado_em AS generated_at,
      pn.created_at,
      pn.consultor_id AS vendedor_id,
      cons.nome AS consultor_nome
    FROM propostas_nativas pn
    JOIN tenant t ON pn.tenant_id = t.tid
    LEFT JOIN latest_versao lv ON lv.proposta_id = pn.id
    LEFT JOIN clientes c ON c.id = pn.cliente_id
    LEFT JOIN leads l ON l.id = pn.lead_id AND pn.cliente_id IS NULL
    LEFT JOIN consultores cons ON cons.id = pn.consultor_id
    WHERE pn.status != 'excluida'
    ORDER BY pn.created_at DESC
    LIMIT p_limit
  ) r;
$$;
