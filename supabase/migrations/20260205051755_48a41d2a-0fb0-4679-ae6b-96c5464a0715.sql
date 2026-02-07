-- ============================================================
-- SECURITY FIX #9: Criar funções RPC públicas para dados do simulador
-- Expõe apenas dados mínimos necessários, sem IDs internos
-- ============================================================

-- Função para obter bancos de financiamento ativos (sem expor IDs)
CREATE OR REPLACE FUNCTION public.get_active_financing_banks()
RETURNS TABLE (
  nome text,
  taxa_mensal numeric,
  max_parcelas integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT nome, taxa_mensal, max_parcelas
  FROM public.financiamento_bancos
  WHERE ativo = true
  ORDER BY ordem
$$;

-- Função para obter configuração da calculadora
CREATE OR REPLACE FUNCTION public.get_calculator_config()
RETURNS TABLE (
  tarifa_media_kwh numeric,
  custo_por_kwp numeric,
  geracao_mensal_por_kwp integer,
  kg_co2_por_kwh numeric,
  percentual_economia integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tarifa_media_kwh, custo_por_kwp, geracao_mensal_por_kwp, kg_co2_por_kwh, percentual_economia
  FROM public.calculadora_config
  LIMIT 1
$$;

-- Função para obter concessionárias ativas (para formulário público)
CREATE OR REPLACE FUNCTION public.get_active_utilities()
RETURNS TABLE (
  nome text,
  sigla text,
  estado text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT nome, sigla, estado
  FROM public.concessionarias
  WHERE ativo = true
  ORDER BY estado, nome
$$;