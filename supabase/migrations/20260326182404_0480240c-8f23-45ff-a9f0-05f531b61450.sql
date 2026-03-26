ALTER TABLE inversores_catalogo
  ADD COLUMN IF NOT EXISTS potencia_maxima_kw numeric,
  ADD COLUMN IF NOT EXISTS tensao_mppt_min_v integer,
  ADD COLUMN IF NOT EXISTS tensao_mppt_max_v integer,
  ADD COLUMN IF NOT EXISTS corrente_saida_a numeric,
  ADD COLUMN IF NOT EXISTS fator_potencia numeric DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS datasheet_url text,
  ADD COLUMN IF NOT EXISTS datasheet_source_url text,
  ADD COLUMN IF NOT EXISTS datasheet_found_at timestamptz,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'rascunho';

-- Add check constraint separately
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inversores_catalogo_status_check'
  ) THEN
    ALTER TABLE inversores_catalogo
      ADD CONSTRAINT inversores_catalogo_status_check
      CHECK (status IN ('rascunho', 'revisao', 'publicado'));
  END IF;
END $$;