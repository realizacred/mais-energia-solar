ALTER TABLE public.tenant_premises
  ADD COLUMN IF NOT EXISTS solaryum_token_vertys text,
  ADD COLUMN IF NOT EXISTS solaryum_token_jng text,
  ADD COLUMN IF NOT EXISTS solaryum_cif_descarga boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS solaryum_ibge_fallback text;