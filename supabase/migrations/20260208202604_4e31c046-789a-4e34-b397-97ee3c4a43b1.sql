-- Add default commission percentage to vendedores table
ALTER TABLE public.vendedores
  ADD COLUMN IF NOT EXISTS percentual_comissao numeric NOT NULL DEFAULT 2.0;

COMMENT ON COLUMN public.vendedores.percentual_comissao IS 'Percentual padrão de comissão do vendedor (ex: 2.0 = 2%)';
