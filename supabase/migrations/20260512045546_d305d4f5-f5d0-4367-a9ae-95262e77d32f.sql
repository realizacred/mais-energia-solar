CREATE OR REPLACE FUNCTION public.sync_proposta_to_projeto_deal(p_proposta_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_projeto_id uuid;
  v_deal_id_pn uuid;
  v_deal_id_proj uuid;
  v_is_principal boolean;
  v_valor numeric;
  v_kwp numeric;
  v_cur_value numeric;
  v_cur_kwp numeric;
  v_cur_proj_valor numeric;
  v_cur_proj_kwp numeric;
BEGIN
  IF p_proposta_id IS NULL THEN RETURN; END IF;

  SELECT pn.projeto_id, pn.deal_id, COALESCE(pn.is_principal, false)
    INTO v_projeto_id, v_deal_id_pn, v_is_principal
  FROM public.propostas_nativas pn
  WHERE pn.id = p_proposta_id;

  IF NOT v_is_principal THEN RETURN; END IF;

  SELECT pv.valor_total, pv.potencia_kwp
    INTO v_valor, v_kwp
  FROM public.proposta_versoes pv
  WHERE pv.proposta_id = p_proposta_id
  ORDER BY (pv.status = 'accepted'::public.proposta_nativa_status) DESC, pv.versao_numero DESC
  LIMIT 1;

  IF v_valor IS NULL AND v_kwp IS NULL THEN RETURN; END IF;

  -- Atualiza projeto apenas se houver mudança real
  IF v_projeto_id IS NOT NULL THEN
    SELECT valor_total, potencia_kwp, deal_id
      INTO v_cur_proj_valor, v_cur_proj_kwp, v_deal_id_proj
      FROM public.projetos WHERE id = v_projeto_id;

    IF (v_valor IS NOT NULL AND v_valor IS DISTINCT FROM v_cur_proj_valor)
       OR (v_kwp IS NOT NULL AND v_kwp IS DISTINCT FROM v_cur_proj_kwp) THEN
      UPDATE public.projetos
         SET valor_total  = COALESCE(v_valor, valor_total),
             potencia_kwp = COALESCE(v_kwp,   potencia_kwp),
             updated_at   = now()
       WHERE id = v_projeto_id;
    END IF;
  END IF;

  -- Atualiza deal vinculado à proposta apenas se houver mudança real
  IF v_deal_id_pn IS NOT NULL THEN
    SELECT value, kwp INTO v_cur_value, v_cur_kwp
      FROM public.deals WHERE id = v_deal_id_pn;

    IF (v_valor IS NOT NULL AND v_valor IS DISTINCT FROM v_cur_value)
       OR (v_kwp IS NOT NULL AND v_kwp IS DISTINCT FROM v_cur_kwp) THEN
      UPDATE public.deals
         SET value = COALESCE(v_valor, value),
             kwp   = COALESCE(v_kwp,   kwp),
             updated_at = now()
       WHERE id = v_deal_id_pn;
    END IF;
  END IF;

  -- Atualiza deal vinculado ao projeto (caso seja diferente) apenas se houver mudança real
  IF v_deal_id_proj IS NOT NULL AND v_deal_id_proj <> COALESCE(v_deal_id_pn, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    SELECT value, kwp INTO v_cur_value, v_cur_kwp
      FROM public.deals WHERE id = v_deal_id_proj;

    IF (v_valor IS NOT NULL AND v_valor IS DISTINCT FROM v_cur_value)
       OR (v_kwp IS NOT NULL AND v_kwp IS DISTINCT FROM v_cur_kwp) THEN
      UPDATE public.deals
         SET value = COALESCE(v_valor, value),
             kwp   = COALESCE(v_kwp,   kwp),
             updated_at = now()
       WHERE id = v_deal_id_proj;
    END IF;
  END IF;
END;
$function$;