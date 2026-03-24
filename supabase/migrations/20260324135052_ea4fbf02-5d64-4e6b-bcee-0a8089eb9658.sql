-- Unique index for deduplication: tenant_id + cpf_cnpj (only when cpf_cnpj is NOT NULL and NOT empty)
-- This prevents duplicate clients with the same CPF/CNPJ within the same tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_tenant_cpf_cnpj_unique
  ON public.clientes (tenant_id, cpf_cnpj)
  WHERE cpf_cnpj IS NOT NULL AND cpf_cnpj <> '';

-- Comment legacy fields for documentation
COMMENT ON COLUMN public.monitor_plants.client_id IS 'DEPRECATED: Legacy client link. Canonical path: unit_plant_links → units_consumidoras → cliente_id';
COMMENT ON COLUMN public.gd_groups.cliente_id IS 'DEPRECATED: Legacy client link. Canonical path: gd_groups.uc_geradora_id → units_consumidoras → cliente_id';