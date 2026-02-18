-- Add label column for display names on roof types
ALTER TABLE public.tenant_roof_area_factors
  ADD COLUMN label text;

-- Populate labels for existing built-in types
UPDATE public.tenant_roof_area_factors SET label = 'Carport' WHERE tipo_telhado = 'carport' AND label IS NULL;
UPDATE public.tenant_roof_area_factors SET label = 'Cerâmico' WHERE tipo_telhado = 'ceramico' AND label IS NULL;
UPDATE public.tenant_roof_area_factors SET label = 'Fibrocimento' WHERE tipo_telhado = 'fibrocimento' AND label IS NULL;
UPDATE public.tenant_roof_area_factors SET label = 'Laje' WHERE tipo_telhado = 'laje' AND label IS NULL;
UPDATE public.tenant_roof_area_factors SET label = 'Shingle' WHERE tipo_telhado = 'shingle' AND label IS NULL;
UPDATE public.tenant_roof_area_factors SET label = 'Metálico' WHERE tipo_telhado = 'metalico' AND label IS NULL;
UPDATE public.tenant_roof_area_factors SET label = 'Zipado' WHERE tipo_telhado = 'zipado' AND label IS NULL;
UPDATE public.tenant_roof_area_factors SET label = 'Solo' WHERE tipo_telhado = 'solo' AND label IS NULL;

-- For any custom types without label, use the slug as fallback
UPDATE public.tenant_roof_area_factors SET label = tipo_telhado WHERE label IS NULL;