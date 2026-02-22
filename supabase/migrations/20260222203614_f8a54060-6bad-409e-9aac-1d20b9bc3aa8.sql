
-- =============================================
-- 1) Remove conflicting global-sequence triggers
--    (keep tenant-based trg_set_* which also sets codigo + titulo)
-- =============================================
DROP TRIGGER IF EXISTS trg_assign_projeto_num ON public.projetos;
DROP TRIGGER IF EXISTS trg_assign_proposta_num ON public.propostas_nativas;

-- =============================================
-- 2) Create get_or_create_cliente RPC
--    SECURITY INVOKER — respects RLS
-- =============================================
CREATE OR REPLACE FUNCTION public.get_or_create_cliente(
  p_nome TEXT,
  p_telefone TEXT,
  p_email TEXT DEFAULT NULL,
  p_cpf_cnpj TEXT DEFAULT NULL,
  p_empresa TEXT DEFAULT NULL,
  p_cep TEXT DEFAULT NULL,
  p_estado TEXT DEFAULT NULL,
  p_cidade TEXT DEFAULT NULL,
  p_rua TEXT DEFAULT NULL,
  p_numero TEXT DEFAULT NULL,
  p_bairro TEXT DEFAULT NULL,
  p_complemento TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_normalized TEXT;
  v_id UUID;
BEGIN
  -- Normalize phone: keep only digits
  v_normalized := regexp_replace(p_telefone, '\D', '', 'g');
  
  -- Must have at least 10 digits to be a valid phone
  IF length(v_normalized) < 10 THEN
    v_normalized := NULL;
  END IF;

  -- Try to find existing client by normalized phone
  IF v_normalized IS NOT NULL AND v_normalized <> '' THEN
    SELECT id INTO v_id
    FROM public.clientes
    WHERE telefone_normalized = v_normalized
    LIMIT 1;
    
    IF v_id IS NOT NULL THEN
      RETURN v_id;
    END IF;
  END IF;

  -- Create new client
  INSERT INTO public.clientes (
    nome, telefone, telefone_normalized,
    email, cpf_cnpj, empresa,
    cep, estado, cidade, rua, numero, bairro, complemento
  ) VALUES (
    p_nome, 
    COALESCE(NULLIF(p_telefone, ''), 'N/A'),
    v_normalized,
    NULLIF(p_email, ''),
    NULLIF(p_cpf_cnpj, ''),
    NULLIF(p_empresa, ''),
    NULLIF(p_cep, ''),
    NULLIF(p_estado, ''),
    NULLIF(p_cidade, ''),
    NULLIF(p_rua, ''),
    NULLIF(p_numero, ''),
    NULLIF(p_bairro, ''),
    NULLIF(p_complemento, '')
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
