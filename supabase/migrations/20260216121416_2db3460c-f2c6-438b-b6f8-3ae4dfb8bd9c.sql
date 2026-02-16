-- FASE 1: Adicionar campos da calculadora pública em tenant_premises
-- para eliminar a dependência de calculadora_config como fonte concorrente

ALTER TABLE public.tenant_premises
  ADD COLUMN IF NOT EXISTS custo_por_kwp numeric NOT NULL DEFAULT 5500,
  ADD COLUMN IF NOT EXISTS geracao_mensal_por_kwp numeric NOT NULL DEFAULT 130,
  ADD COLUMN IF NOT EXISTS kg_co2_por_kwh numeric NOT NULL DEFAULT 0.084,
  ADD COLUMN IF NOT EXISTS percentual_economia numeric NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS vida_util_sistema integer NOT NULL DEFAULT 25;

COMMENT ON COLUMN public.tenant_premises.custo_por_kwp IS 'Custo médio de instalação por kWp (R$). Usado pela calculadora pública.';
COMMENT ON COLUMN public.tenant_premises.geracao_mensal_por_kwp IS 'kWh gerados por kWp instalado/mês. Fallback quando motor de irradiância não disponível.';
COMMENT ON COLUMN public.tenant_premises.kg_co2_por_kwh IS 'kg de CO2 evitado por kWh gerado. Fator de emissão da rede.';
COMMENT ON COLUMN public.tenant_premises.percentual_economia IS 'Percentual estimado de economia na conta de luz (%).';
COMMENT ON COLUMN public.tenant_premises.vida_util_sistema IS 'Vida útil estimada do sistema fotovoltaico em anos.';

-- Migrar dados existentes de calculadora_config → tenant_premises (one-shot)
UPDATE public.tenant_premises tp
SET
  custo_por_kwp = COALESCE(cc.custo_por_kwp, 5500),
  geracao_mensal_por_kwp = COALESCE(cc.geracao_mensal_por_kwp, 130),
  kg_co2_por_kwh = COALESCE(cc.kg_co2_por_kwh, 0.084),
  percentual_economia = COALESCE(cc.percentual_economia, 90),
  vida_util_sistema = COALESCE(cc.vida_util_sistema, 25)
FROM public.calculadora_config cc
WHERE cc.tenant_id = tp.tenant_id;