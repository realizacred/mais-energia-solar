
-- Fase 2.1: Campos de demanda e bandeira tarifária na fatura
-- Permite registro completo de faturas grupo A e B

-- Enum bandeira tarifária
CREATE TYPE public.bandeira_tarifaria AS ENUM ('verde', 'amarela', 'vermelha_1', 'vermelha_2');

ALTER TABLE public.unit_invoices
  ADD COLUMN IF NOT EXISTS demanda_contratada_kw numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS demanda_medida_kw numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ultrapassagem_kw numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS multa_ultrapassagem numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bandeira_tarifaria public.bandeira_tarifaria DEFAULT NULL;

COMMENT ON COLUMN public.unit_invoices.demanda_contratada_kw IS 'Demanda contratada em kW (grupo A)';
COMMENT ON COLUMN public.unit_invoices.demanda_medida_kw IS 'Demanda medida/registrada em kW';
COMMENT ON COLUMN public.unit_invoices.ultrapassagem_kw IS 'Ultrapassagem de demanda em kW';
COMMENT ON COLUMN public.unit_invoices.multa_ultrapassagem IS 'Valor da multa por ultrapassagem em R$';
COMMENT ON COLUMN public.unit_invoices.bandeira_tarifaria IS 'Bandeira tarifária vigente no mês';
