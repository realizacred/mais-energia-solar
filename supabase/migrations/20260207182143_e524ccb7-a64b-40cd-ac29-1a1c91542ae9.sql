
-- 1. get_active_financing_banks: Returns active banks for public financing simulator
CREATE OR REPLACE FUNCTION public.get_active_financing_banks()
RETURNS TABLE(nome text, taxa_mensal numeric, max_parcelas integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT nome, taxa_mensal, max_parcelas
  FROM financiamento_bancos
  WHERE ativo = true
  ORDER BY ordem ASC, nome ASC;
$$;

-- 2. validate_vendedor_code: Validates a vendor code and returns basic info (public access)
CREATE OR REPLACE FUNCTION public.validate_vendedor_code(_codigo text)
RETURNS TABLE(codigo text, nome text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT codigo, nome
  FROM vendedores
  WHERE codigo = _codigo
    AND ativo = true;
$$;

-- 3. check_phone_duplicate: Returns true if phone already exists in leads (for anon users)
CREATE OR REPLACE FUNCTION public.check_phone_duplicate(_telefone text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized text;
  found boolean;
BEGIN
  -- Normalize phone: remove non-digits
  normalized := regexp_replace(_telefone, '[^0-9]', '', 'g');
  
  SELECT EXISTS(
    SELECT 1 FROM leads
    WHERE telefone_normalized = normalized
       OR regexp_replace(telefone, '[^0-9]', '', 'g') = normalized
  ) INTO found;
  
  RETURN found;
END;
$$;

-- 4. get_calculator_config: Returns calculator configuration (public access, no IDs exposed)
CREATE OR REPLACE FUNCTION public.get_calculator_config()
RETURNS TABLE(
  tarifa_media_kwh numeric,
  custo_por_kwp numeric,
  geracao_mensal_por_kwp integer,
  kg_co2_por_kwh numeric,
  percentual_economia integer,
  vida_util_sistema integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tarifa_media_kwh, custo_por_kwp, geracao_mensal_por_kwp,
         kg_co2_por_kwh, percentual_economia, vida_util_sistema
  FROM calculadora_config
  LIMIT 1;
$$;

-- 5. update_parcelas_atrasadas: Updates overdue parcelas status to 'atrasada'
CREATE OR REPLACE FUNCTION public.update_parcelas_atrasadas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE parcelas
  SET status = 'atrasada',
      updated_at = now()
  WHERE data_vencimento < CURRENT_DATE
    AND status = 'pendente';
END;
$$;
