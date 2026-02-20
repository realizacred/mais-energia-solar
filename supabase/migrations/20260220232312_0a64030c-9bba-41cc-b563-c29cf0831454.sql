
-- Add precision tracking column to tariff_versions
ALTER TABLE public.tariff_versions 
ADD COLUMN IF NOT EXISTS precisao text NOT NULL DEFAULT 'estimado'
CHECK (precisao IN ('exato', 'estimado'));

COMMENT ON COLUMN public.tariff_versions.precisao IS 
'exato = Fio B real disponível da ANEEL; estimado = usando TUSD total como proxy do Fio B';
