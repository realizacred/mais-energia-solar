
-- Add unique constraint for upsert on concessionaria_tarifas_subgrupo
-- This enables the sync to upsert BT subgroups after each ANEEL sync
CREATE UNIQUE INDEX IF NOT EXISTS idx_cts_conc_sub_tenant 
ON concessionaria_tarifas_subgrupo (concessionaria_id, subgrupo, tenant_id);
