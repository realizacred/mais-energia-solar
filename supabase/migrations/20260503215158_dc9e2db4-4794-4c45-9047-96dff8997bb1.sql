ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS is_sm_migrado boolean NOT NULL DEFAULT false;

UPDATE public.clientes SET is_sm_migrado = true WHERE external_source = 'solarmarket' AND is_sm_migrado = false;

CREATE INDEX IF NOT EXISTS idx_clientes_tenant_cpf_cnpj_norm
  ON public.clientes (tenant_id, regexp_replace(coalesce(cpf_cnpj,''), '\D', '', 'g'))
  WHERE cpf_cnpj IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clientes_tenant_email_lower
  ON public.clientes (tenant_id, lower(email))
  WHERE email IS NOT NULL;