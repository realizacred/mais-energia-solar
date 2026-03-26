ALTER TABLE public.pipeline_stages
  ADD COLUMN IF NOT EXISTS color text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS card_visible_fields text[] DEFAULT ARRAY['valor_projeto', 'potencia_kwp', 'cidade']::text[];