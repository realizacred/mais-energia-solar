-- Add technical columns to tenant_roof_area_factors
-- This expands the table to serve as a complete "roof profile" per tenant

ALTER TABLE public.tenant_roof_area_factors
  ADD COLUMN IF NOT EXISTS desvio_azimutal_padrao numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS topologias_permitidas text[] DEFAULT ARRAY['tradicional', 'microinversor', 'otimizador'],
  ADD COLUMN IF NOT EXISTS tipos_sistema_permitidos text[] DEFAULT ARRAY['on_grid', 'hibrido', 'off_grid'];

-- Add comments for documentation
COMMENT ON COLUMN public.tenant_roof_area_factors.desvio_azimutal_padrao IS 'Desvio azimutal padrão em graus para este tipo de telhado';
COMMENT ON COLUMN public.tenant_roof_area_factors.topologias_permitidas IS 'Topologias de inversor permitidas: tradicional, microinversor, otimizador';
COMMENT ON COLUMN public.tenant_roof_area_factors.tipos_sistema_permitidos IS 'Tipos de sistema permitidos: on_grid, hibrido, off_grid';