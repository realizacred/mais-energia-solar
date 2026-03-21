-- Add GD-related fields to units_consumidoras
ALTER TABLE public.units_consumidoras
  ADD COLUMN IF NOT EXISTS papel_gd text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS categoria_gd text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS email_fatura text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS leitura_automatica_email boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cliente_id uuid DEFAULT NULL REFERENCES public.clientes(id) ON DELETE SET NULL;

ALTER TABLE public.units_consumidoras
  ADD CONSTRAINT chk_papel_gd CHECK (papel_gd IN ('none', 'geradora', 'beneficiaria'));

ALTER TABLE public.units_consumidoras
  ADD CONSTRAINT chk_categoria_gd CHECK (categoria_gd IS NULL OR categoria_gd IN ('gd1', 'gd2', 'gd3'));

CREATE INDEX IF NOT EXISTS idx_units_consumidoras_cliente_id ON public.units_consumidoras(cliente_id);