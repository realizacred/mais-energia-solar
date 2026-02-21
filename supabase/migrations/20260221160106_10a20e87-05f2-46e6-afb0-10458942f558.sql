
-- Add PIS, COFINS percentages and Fio B GD to concessionarias
ALTER TABLE public.concessionarias
  ADD COLUMN IF NOT EXISTS pis_percentual numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cofins_percentual numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tarifa_fio_b_gd numeric DEFAULT NULL;

COMMENT ON COLUMN public.concessionarias.pis_percentual IS 'Alíquota PIS (%) — tipicamente ~1.65%';
COMMENT ON COLUMN public.concessionarias.cofins_percentual IS 'Alíquota COFINS (%) — tipicamente ~7.60%';
COMMENT ON COLUMN public.concessionarias.tarifa_fio_b_gd IS 'Valor do Fio B aplicável na regra de GD (R$/kWh) — parcela que o prosumidor paga';
