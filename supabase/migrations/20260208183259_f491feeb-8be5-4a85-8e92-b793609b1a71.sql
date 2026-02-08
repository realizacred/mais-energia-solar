
-- Add ICMS/tributação columns to concessionarias table
-- This allows per-concessionária tax configuration instead of only per-state
ALTER TABLE public.concessionarias
  ADD COLUMN IF NOT EXISTS aliquota_icms numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS possui_isencao_scee boolean DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS percentual_isencao numeric DEFAULT NULL;

-- Add comment explaining the logic
COMMENT ON COLUMN public.concessionarias.aliquota_icms IS 'Alíquota ICMS específica da concessionária. Se NULL, usa o valor do estado (config_tributaria_estado).';
COMMENT ON COLUMN public.concessionarias.possui_isencao_scee IS 'Se a concessionária aplica isenção SCEE. Se NULL, usa o valor do estado.';
COMMENT ON COLUMN public.concessionarias.percentual_isencao IS 'Percentual de isenção SCEE (0-100). Se NULL, usa o valor do estado.';
