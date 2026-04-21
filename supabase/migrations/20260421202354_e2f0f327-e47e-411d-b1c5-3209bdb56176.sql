-- Permitir defaults non-null em solarmarket_promotion_logs para evitar 100% de falhas
-- quando a edge sm-promote loga sem entity ou details estruturados.

ALTER TABLE public.solarmarket_promotion_logs
  ALTER COLUMN details SET DEFAULT '{}'::jsonb,
  ALTER COLUMN details DROP NOT NULL;

ALTER TABLE public.solarmarket_promotion_logs
  ALTER COLUMN source_entity_type DROP NOT NULL;

-- Backfill de eventuais nulos pré-existentes (defensivo)
UPDATE public.solarmarket_promotion_logs
   SET details = '{}'::jsonb
 WHERE details IS NULL;