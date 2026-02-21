-- Drop the old unique index that doesn't include modalidade_tarifaria
DROP INDEX IF EXISTS public.idx_cts_conc_sub_tenant;

-- Create the correct unique index including modalidade_tarifaria
CREATE UNIQUE INDEX idx_cts_conc_sub_tenant 
ON public.concessionaria_tarifas_subgrupo (tenant_id, concessionaria_id, subgrupo, modalidade_tarifaria);