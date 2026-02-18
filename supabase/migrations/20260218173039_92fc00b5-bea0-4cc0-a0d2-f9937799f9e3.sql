-- RPC pública para buscar tipos de telhado pelo código do consultor
-- SECURITY DEFINER para contornar RLS de forma segura
CREATE OR REPLACE FUNCTION public.get_roof_types_by_consultor(p_consultor_code text)
RETURNS TABLE(tipo_telhado text, label text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  -- Resolve tenant via consultor code (determinístico, sem fallback)
  SELECT c.tenant_id INTO v_tenant_id
  FROM consultores c
  WHERE c.codigo = p_consultor_code
    AND c.ativo = true
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    -- Retorna vazio se consultor não encontrado
    RETURN;
  END IF;

  RETURN QUERY
  SELECT r.tipo_telhado, r.label
  FROM tenant_roof_area_factors r
  WHERE r.tenant_id = v_tenant_id
    AND r.enabled = true
  ORDER BY r.tipo_telhado;
END;
$$;