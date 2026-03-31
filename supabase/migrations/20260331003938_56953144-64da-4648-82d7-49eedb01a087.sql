-- Passo 1: Remover índice parcial problemático
DROP INDEX IF EXISTS uq_solar_kit_catalog_tenant_fornecedor_external;

-- Passo 2: Criar índice COMPLETO (sem WHERE) para ON CONFLICT funcionar
CREATE UNIQUE INDEX uq_kit_catalog_tenant_fornecedor_external
ON solar_kit_catalog (tenant_id, fornecedor_id, external_id);

-- Passo 3: Remover constraint de nome único (é constraint, não index)
ALTER TABLE solar_kit_catalog DROP CONSTRAINT IF EXISTS uq_solar_kit_catalog_tenant_name;

-- Passo 4: Remover índices duplicados de solar_kit_catalog_items
DROP INDEX IF EXISTS uq_solar_kit_catalog_items_dedup_null_ref;
DROP INDEX IF EXISTS uq_solar_kit_catalog_items_dedupe;
DROP INDEX IF EXISTS uq_solar_kit_catalog_items_ref;