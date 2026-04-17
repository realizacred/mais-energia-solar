-- Corrige search_path
CREATE OR REPLACE FUNCTION public.validate_phone_quality(_phone text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  digits text;
  len int;
BEGIN
  IF _phone IS NULL OR length(trim(_phone)) = 0 THEN
    RETURN false;
  END IF;

  digits := regexp_replace(_phone, '\D', '', 'g');
  len := length(digits);

  IF len < 10 OR len > 13 THEN
    RETURN false;
  END IF;

  IF digits ~ '^(\d)\1+$' THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

-- Função: garante existência da etapa "Verificar Dados" no funil Comercial do tenant.
-- Retorna { funil_id, etapa_id } como JSONB.
CREATE OR REPLACE FUNCTION public.get_or_create_verificar_dados_stage(_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_funil_id uuid;
  v_etapa_id uuid;
  v_max_ordem int;
BEGIN
  -- 1) Funil Comercial
  SELECT id INTO v_funil_id
  FROM public.projeto_funis
  WHERE tenant_id = _tenant_id
    AND lower(unaccent(nome)) = 'comercial'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_funil_id IS NULL THEN
    INSERT INTO public.projeto_funis (tenant_id, nome, ordem, ativo)
    VALUES (_tenant_id, 'Comercial', 1, true)
    RETURNING id INTO v_funil_id;
  END IF;

  -- 2) Etapa "Verificar Dados" dentro do Comercial
  SELECT id INTO v_etapa_id
  FROM public.projeto_etapas
  WHERE funil_id = v_funil_id
    AND lower(unaccent(nome)) = 'verificar dados'
  LIMIT 1;

  IF v_etapa_id IS NULL THEN
    SELECT COALESCE(MAX(ordem), 0) INTO v_max_ordem
    FROM public.projeto_etapas
    WHERE funil_id = v_funil_id;

    INSERT INTO public.projeto_etapas (
      tenant_id, funil_id, nome, ordem, cor, categoria
    )
    VALUES (
      _tenant_id, v_funil_id, 'Verificar Dados', v_max_ordem + 1, '#f59e0b', 'aberto'
    )
    RETURNING id INTO v_etapa_id;
  END IF;

  RETURN jsonb_build_object('funil_id', v_funil_id, 'etapa_id', v_etapa_id);
END;
$$;

COMMENT ON FUNCTION public.get_or_create_verificar_dados_stage IS
'Resolve (e cria se necessário) o destino fallback Comercial/Verificar Dados para o tenant.';