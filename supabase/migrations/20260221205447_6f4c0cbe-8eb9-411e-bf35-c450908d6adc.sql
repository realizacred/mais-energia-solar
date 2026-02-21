
ALTER TABLE public.tenant_roof_area_factors
ADD COLUMN inclinacao_padrao numeric DEFAULT 10;

COMMENT ON COLUMN public.tenant_roof_area_factors.inclinacao_padrao IS 'Inclinação padrão dos módulos em graus para este tipo de telhado';
