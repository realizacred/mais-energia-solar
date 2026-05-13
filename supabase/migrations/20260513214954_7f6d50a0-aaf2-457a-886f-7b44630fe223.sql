CREATE OR REPLACE FUNCTION public.get_proposal_template_for_landing(
  _template_id uuid,
  _tenant_id uuid
)
RETURNS TABLE (
  id uuid,
  nome text,
  tipo text,
  is_default boolean,
  template_html jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1) tenta o template explicitamente vinculado à versão (se for HTML válido)
  IF _template_id IS NOT NULL THEN
    RETURN QUERY
    SELECT t.id, t.nome, t.tipo, t.is_default,
           CASE WHEN jsonb_typeof(t.template_html::jsonb) IS NOT NULL THEN t.template_html::jsonb ELSE NULL END
    FROM public.proposta_templates t
    WHERE t.id = _template_id
      AND t.tipo = 'html'
      AND t.ativo = true
      AND t.template_html IS NOT NULL
    LIMIT 1;

    IF FOUND THEN RETURN; END IF;
  END IF;

  -- 2) fallback: default HTML do tenant
  IF _tenant_id IS NOT NULL THEN
    RETURN QUERY
    SELECT t.id, t.nome, t.tipo, t.is_default,
           CASE WHEN jsonb_typeof(t.template_html::jsonb) IS NOT NULL THEN t.template_html::jsonb ELSE NULL END
    FROM public.proposta_templates t
    WHERE t.tenant_id = _tenant_id
      AND t.tipo = 'html'
      AND t.ativo = true
      AND t.is_default = true
      AND t.template_html IS NOT NULL
    ORDER BY t.created_at DESC
    LIMIT 1;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_proposal_template_for_landing(uuid, uuid) TO anon, authenticated;