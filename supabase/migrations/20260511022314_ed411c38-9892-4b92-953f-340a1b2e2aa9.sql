
-- Inbox Premium — paginação cursor + sumário real
-- RB-76: reaproveita vw_proposal_followup_inbox, sem tabelas/edge novas

CREATE OR REPLACE FUNCTION public.get_followup_inbox_summary(
  p_classe text DEFAULT NULL,
  p_consultor_id uuid DEFAULT NULL,
  p_dias_min integer DEFAULT NULL,
  p_search text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH base AS (
    SELECT valor_total, dias_parado
    FROM public.vw_proposal_followup_inbox v
    WHERE (p_classe IS NULL OR p_classe = 'todos' OR v.classe_followup = p_classe)
      AND (p_consultor_id IS NULL OR v.consultor_id = p_consultor_id)
      AND (p_dias_min IS NULL OR p_dias_min <= 0 OR v.dias_parado >= p_dias_min)
      AND (
        p_search IS NULL OR length(btrim(p_search)) < 2
        OR v.cliente_nome ILIKE '%' || btrim(p_search) || '%'
        OR v.titulo       ILIKE '%' || btrim(p_search) || '%'
        OR v.codigo       ILIKE '%' || btrim(p_search) || '%'
      )
  )
  SELECT jsonb_build_object(
    'total_count',           COUNT(*),
    'valor_potencial_total', COALESCE(SUM(valor_total), 0),
    'dias_parado_p50',       COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY dias_parado), 0),
    'dias_parado_p90',       COALESCE(percentile_cont(0.9) WITHIN GROUP (ORDER BY dias_parado), 0)
  )
  FROM base;
$$;

GRANT EXECUTE ON FUNCTION public.get_followup_inbox_summary(text, uuid, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_followup_inbox_page(
  p_classe text DEFAULT NULL,
  p_consultor_id uuid DEFAULT NULL,
  p_dias_min integer DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_sort text DEFAULT 'dias_parado',  -- dias_parado | score_ia | valor_total | ultima_atividade
  p_cursor_value numeric DEFAULT NULL, -- valor da chave de ordenação do último item da página anterior
  p_cursor_id uuid DEFAULT NULL,       -- proposta_id do último item (tiebreaker)
  p_page_size integer DEFAULT 50
)
RETURNS SETOF public.vw_proposal_followup_inbox
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_size integer := LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 100);
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT v.*,
      CASE p_sort
        WHEN 'score_ia'         THEN v.score_ia
        WHEN 'valor_total'      THEN v.valor_total
        WHEN 'ultima_atividade' THEN EXTRACT(EPOCH FROM v.ultima_atividade_em)::numeric
        ELSE v.dias_parado
      END AS sort_key
    FROM public.vw_proposal_followup_inbox v
    WHERE (p_classe IS NULL OR p_classe = 'todos' OR v.classe_followup = p_classe)
      AND (p_consultor_id IS NULL OR v.consultor_id = p_consultor_id)
      AND (p_dias_min IS NULL OR p_dias_min <= 0 OR v.dias_parado >= p_dias_min)
      AND (
        p_search IS NULL OR length(btrim(p_search)) < 2
        OR v.cliente_nome ILIKE '%' || btrim(p_search) || '%'
        OR v.titulo       ILIKE '%' || btrim(p_search) || '%'
        OR v.codigo       ILIKE '%' || btrim(p_search) || '%'
      )
  )
  SELECT
    proposta_id, tenant_id, consultor_id, cliente_id, lead_id, deal_id,
    codigo, titulo, status, is_principal, enviada_at, aceita_at, recusada_at,
    primeiro_acesso_em, ultimo_acesso_em, total_aberturas, status_visualizacao,
    versao_id, versao_numero, valor_total, potencia_kwp, valido_ate,
    versao_viewed_at, cliente_nome, telefone_normalized, cliente_email,
    ultima_atividade_em, dias_parado, classe_followup, temperatura, score_ia,
    sugestao_ia, objecao_principal, proxima_acao_em, qtd_followups,
    ultima_mensagem, ultimo_canal, ultimo_outcome, ultimo_followup_em,
    bloqueado_ate, projeto_id
  FROM base
  WHERE
    p_cursor_value IS NULL
    OR sort_key IS NULL
    OR sort_key < p_cursor_value
    OR (sort_key = p_cursor_value AND (p_cursor_id IS NULL OR proposta_id > p_cursor_id))
  ORDER BY sort_key DESC NULLS LAST, proposta_id ASC
  LIMIT v_size;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_followup_inbox_page(text, uuid, integer, text, text, numeric, uuid, integer) TO authenticated;
