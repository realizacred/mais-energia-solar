-- Add representante legal columns to brand_settings
ALTER TABLE public.brand_settings
  ADD COLUMN IF NOT EXISTS representante_legal text,
  ADD COLUMN IF NOT EXISTS representante_cpf text,
  ADD COLUMN IF NOT EXISTS representante_cargo text;