
CREATE OR REPLACE FUNCTION public.check_proposta_projeto_deal_consistency()
RETURNS TABLE (
  proposta_id uuid,
  projeto_id uuid,
  deal_id uuid,
  src_valor numeric,
  src_kwp numeric,
  projeto_valor numeric,
  projeto_kwp numeric,
  deal_value numeric,
  deal_kwp numeric,
  projeto_divergente boolean,
  deal_divergente boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH src AS (
    SELECT DISTINCT ON (pn.id)
      pn.id AS proposta_id, pn.projeto_id AS s_projeto_id, pn.deal_id AS s_deal_id,
      pv.valor_total AS src_valor, pv.potencia_kwp AS src_kwp
    FROM public.propostas_nativas pn
    JOIN public.proposta_versoes pv ON pv.proposta_id = pn.id
    WHERE pn.is_principal = true
    ORDER BY pn.id, (pv.status::text = 'accepted') DESC, pv.versao_numero DESC
  )
  SELECT
    s.proposta_id, s.s_projeto_id, s.s_deal_id,
    s.src_valor, s.src_kwp,
    pr.valor_total, pr.potencia_kwp,
    d.value, d.kwp,
    (s.s_projeto_id IS NOT NULL AND (
         COALESCE(pr.valor_total,-1) IS DISTINCT FROM COALESCE(s.src_valor, pr.valor_total)
      OR COALESCE(pr.potencia_kwp,-1) IS DISTINCT FROM COALESCE(s.src_kwp, pr.potencia_kwp)
    )),
    (s.s_deal_id IS NOT NULL AND (
         COALESCE(d.value,-1) IS DISTINCT FROM COALESCE(s.src_valor, d.value)
      OR COALESCE(d.kwp,-1)   IS DISTINCT FROM COALESCE(s.src_kwp, d.kwp)
    ))
  FROM src s
  LEFT JOIN public.projetos pr ON pr.id = s.s_projeto_id
  LEFT JOIN public.deals d ON d.id = s.s_deal_id
  WHERE
    (s.s_projeto_id IS NOT NULL AND (
         COALESCE(pr.valor_total,-1) IS DISTINCT FROM COALESCE(s.src_valor, pr.valor_total)
      OR COALESCE(pr.potencia_kwp,-1) IS DISTINCT FROM COALESCE(s.src_kwp, pr.potencia_kwp)
    ))
    OR
    (s.s_deal_id IS NOT NULL AND (
         COALESCE(d.value,-1) IS DISTINCT FROM COALESCE(s.src_valor, d.value)
      OR COALESCE(d.kwp,-1)   IS DISTINCT FROM COALESCE(s.src_kwp, d.kwp)
    ));
$$;
