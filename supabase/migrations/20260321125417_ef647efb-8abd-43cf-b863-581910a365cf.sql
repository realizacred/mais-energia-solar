
-- Add simulacao_id to units_consumidoras for linking to proposta_versoes
ALTER TABLE public.units_consumidoras
ADD COLUMN simulacao_id UUID NULL;

CREATE INDEX idx_units_simulacao_id ON public.units_consumidoras(simulacao_id);
