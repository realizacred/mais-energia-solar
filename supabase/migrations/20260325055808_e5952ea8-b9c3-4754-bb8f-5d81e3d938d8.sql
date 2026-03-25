
-- ═══════════════════════════════════════════════════════
-- 1. RPC proposal_update_status — backend-driven status transitions
-- ═══════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.proposal_update_status(
  p_proposta_id uuid,
  p_new_status text,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_user_id uuid;
  v_current_status text;
  v_proposta record;
  v_allowed text[];
BEGIN
  -- 1. Resolve caller
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  v_tenant_id := current_tenant_id();
  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_tenant');
  END IF;

  -- 2. Fetch proposta with tenant check
  SELECT id, status, tenant_id
    INTO v_proposta
    FROM propostas_nativas
   WHERE id = p_proposta_id
     AND tenant_id = v_tenant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  v_current_status := v_proposta.status::text;

  -- 3. Validate transition (mirrors proposalStateMachine.ts)
  v_allowed := CASE v_current_status
    WHEN 'rascunho'  THEN ARRAY['gerada']
    WHEN 'gerada'    THEN ARRAY['enviada', 'aceita', 'recusada', 'cancelada']
    WHEN 'enviada'   THEN ARRAY['vista', 'aceita', 'recusada', 'cancelada']
    WHEN 'vista'     THEN ARRAY['aceita', 'recusada', 'cancelada']
    WHEN 'aceita'    THEN ARRAY['cancelada']
    WHEN 'recusada'  THEN ARRAY['gerada', 'enviada']
    WHEN 'expirada'  THEN ARRAY['gerada']
    WHEN 'cancelada' THEN ARRAY[]::text[]
    WHEN 'arquivada' THEN ARRAY['rascunho', 'gerada']
    ELSE ARRAY[]::text[]
  END;

  IF NOT (p_new_status = ANY(v_allowed)) THEN
    RETURN jsonb_build_object(
      'error', 'invalid_transition',
      'current_status', v_current_status,
      'requested_status', p_new_status,
      'allowed', to_jsonb(v_allowed)
    );
  END IF;

  -- 4. Update status
  UPDATE propostas_nativas
     SET status = p_new_status::proposta_nativa_status,
         updated_at = now()
   WHERE id = p_proposta_id
     AND tenant_id = v_tenant_id;

  -- 5. Audit log
  INSERT INTO audit_logs (tenant_id, user_id, tabela, acao, registro_id, dados_anteriores, dados_novos)
  VALUES (
    v_tenant_id,
    v_user_id,
    'propostas_nativas',
    'status_change',
    p_proposta_id::text,
    jsonb_build_object('status', v_current_status),
    jsonb_build_object('status', p_new_status, 'motivo', coalesce(p_motivo, ''))
  );

  RETURN jsonb_build_object(
    'success', true,
    'proposta_id', p_proposta_id,
    'previous_status', v_current_status,
    'new_status', p_new_status
  );
END;
$$;

-- ═══════════════════════════════════════════════════════
-- 2. Evolve proposal_list with pagination + filters
-- ═══════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.proposal_list(
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0,
  p_status text DEFAULT NULL,
  p_consultor_id uuid DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH tenant AS (
    SELECT current_tenant_id() AS tid
  ),
  filtered_propostas AS (
    SELECT pn.*
    FROM propostas_nativas pn
    JOIN tenant t ON pn.tenant_id = t.tid
    WHERE pn.status != 'excluida'
      AND (p_status IS NULL OR pn.status::text = p_status)
      AND (p_consultor_id IS NULL OR pn.consultor_id = p_consultor_id)
      AND (p_date_from IS NULL OR pn.created_at >= p_date_from)
      AND (p_date_to IS NULL OR pn.created_at <= p_date_to)
  ),
  total_count AS (
    SELECT count(*) AS cnt FROM filtered_propostas
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
    JOIN filtered_propostas fp ON fp.id = pv.proposta_id
    ORDER BY pv.proposta_id, pv.versao_numero DESC
  ),
  rows AS (
    SELECT
      fp.id,
      coalesce(fp.titulo, fp.codigo, 'Proposta') AS nome,
      fp.status::text AS status,
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
      fp.created_at,
      fp.consultor_id AS vendedor_id,
      cons.nome AS consultor_nome
    FROM filtered_propostas fp
    LEFT JOIN latest_versao lv ON lv.proposta_id = fp.id
    LEFT JOIN clientes c ON c.id = fp.cliente_id
    LEFT JOIN leads l ON l.id = fp.lead_id AND fp.cliente_id IS NULL
    LEFT JOIN consultores cons ON cons.id = fp.consultor_id
    WHERE (p_search IS NULL OR (
      coalesce(c.nome, l.nome, lv.snapshot->>'clienteNome', '') ILIKE '%' || p_search || '%'
      OR coalesce(fp.titulo, fp.codigo, '') ILIKE '%' || p_search || '%'
    ))
    ORDER BY fp.created_at DESC
    LIMIT p_limit
    OFFSET p_offset
  )
  SELECT jsonb_build_object(
    'data', coalesce((SELECT jsonb_agg(row_to_json(r)::jsonb) FROM rows r), '[]'::jsonb),
    'total', (SELECT cnt FROM total_count),
    'limit', p_limit,
    'offset', p_offset
  );
$$;
