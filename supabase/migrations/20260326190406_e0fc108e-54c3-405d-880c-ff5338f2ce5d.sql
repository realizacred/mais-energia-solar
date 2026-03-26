ALTER TABLE otimizadores_catalogo
  ADD COLUMN IF NOT EXISTS dimensoes_mm text,
  ADD COLUMN IF NOT EXISTS peso_kg numeric,
  ADD COLUMN IF NOT EXISTS garantia_anos integer DEFAULT 25,
  ADD COLUMN IF NOT EXISTS ip_protection text DEFAULT 'IP65',
  ADD COLUMN IF NOT EXISTS datasheet_url text,
  ADD COLUMN IF NOT EXISTS datasheet_source_url text,
  ADD COLUMN IF NOT EXISTS datasheet_found_at timestamptz,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'rascunho';

ALTER TABLE otimizadores_catalogo
  ADD CONSTRAINT otimizadores_catalogo_status_check
  CHECK (status IN ('rascunho', 'revisao', 'publicado'));