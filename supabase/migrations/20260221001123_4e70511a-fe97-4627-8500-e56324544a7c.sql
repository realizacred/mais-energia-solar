-- Add precision tracking and audit columns to propostas_nativas
ALTER TABLE public.propostas_nativas
  ADD COLUMN IF NOT EXISTS precisao_calculo text DEFAULT 'desconhecido',
  ADD COLUMN IF NOT EXISTS precisao_motivo text,
  ADD COLUMN IF NOT EXISTS aceite_estimativa boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_aceite_estimativa timestamptz,
  ADD COLUMN IF NOT EXISTS tariff_version_id uuid,
  ADD COLUMN IF NOT EXISTS aneel_run_id uuid,
  ADD COLUMN IF NOT EXISTS regra_gd text,
  ADD COLUMN IF NOT EXISTS ano_gd integer,
  ADD COLUMN IF NOT EXISTS fio_b_percent_aplicado numeric,
  ADD COLUMN IF NOT EXISTS origem_tarifa text,
  ADD COLUMN IF NOT EXISTS vigencia_tarifa text,
  ADD COLUMN IF NOT EXISTS snapshot_hash text,
  ADD COLUMN IF NOT EXISTS missing_variables text[];

-- Add foreign keys where applicable
ALTER TABLE public.propostas_nativas
  ADD CONSTRAINT propostas_nativas_tariff_version_id_fkey
    FOREIGN KEY (tariff_version_id) REFERENCES public.tariff_versions(id)
    ON DELETE SET NULL;

ALTER TABLE public.propostas_nativas
  ADD CONSTRAINT propostas_nativas_aneel_run_id_fkey
    FOREIGN KEY (aneel_run_id) REFERENCES public.aneel_sync_runs(id)
    ON DELETE SET NULL;

-- Comment for documentation
COMMENT ON COLUMN public.propostas_nativas.precisao_calculo IS 'exato | estimado | desconhecido';
COMMENT ON COLUMN public.propostas_nativas.aceite_estimativa IS 'true se o usuário confirmou que entendeu que valores são estimados';
COMMENT ON COLUMN public.propostas_nativas.missing_variables IS 'Lista de variáveis required que faltaram no momento da geração';