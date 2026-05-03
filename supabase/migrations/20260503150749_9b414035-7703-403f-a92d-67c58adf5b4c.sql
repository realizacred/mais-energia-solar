
CREATE OR REPLACE FUNCTION public.sync_proposta_to_projeto_deal(p_proposta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_projeto_id uuid;
  v_deal_id uuid;
  v_is_principal boolean;
  v_valor numeric;
  v_kwp numeric;
BEGIN
  IF p_proposta_id IS NULL THEN
    RETURN;
  END IF;

  SELECT pn.projeto_id, pn.deal_id, COALESCE(pn.is_principal, false)
    INTO v_projeto_id, v_deal_id, v_is_principal
  FROM public.propostas_nativas pn
  WHERE pn.id = p_proposta_id;

  IF NOT v_is_principal THEN
    RETURN;
  END IF;

  SELECT pv.valor_total, pv.potencia_kwp
    INTO v_valor, v_kwp
  FROM public.proposta_versoes pv
  WHERE pv.proposta_id = p_proposta_id
  ORDER BY (pv.status::text = 'accepted') DESC, pv.versao_numero DESC
  LIMIT 1;

  IF v_valor IS NULL AND v_kwp IS NULL THEN
    RETURN;
  END IF;

  IF v_projeto_id IS NOT NULL THEN
    UPDATE public.projetos
       SET valor_total   = COALESCE(v_valor, valor_total),
           potencia_kwp  = COALESCE(v_kwp,   potencia_kwp),
           updated_at    = now()
     WHERE id = v_projeto_id
       AND (
            COALESCE(valor_total, -1)  IS DISTINCT FROM COALESCE(v_valor, valor_total)
         OR COALESCE(potencia_kwp,-1)  IS DISTINCT FROM COALESCE(v_kwp,  potencia_kwp)
       );
  END IF;

  IF v_deal_id IS NOT NULL THEN
    UPDATE public.deals
       SET value      = COALESCE(v_valor, value),
           kwp        = COALESCE(v_kwp,   kwp),
           updated_at = now()
     WHERE id = v_deal_id
       AND (
            COALESCE(value, -1) IS DISTINCT FROM COALESCE(v_valor, value)
         OR COALESCE(kwp,  -1) IS DISTINCT FROM COALESCE(v_kwp,   kwp)
       );
  END IF;
END;
$$;
