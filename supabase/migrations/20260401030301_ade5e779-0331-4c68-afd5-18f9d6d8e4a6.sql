CREATE UNIQUE INDEX IF NOT EXISTS idx_inversores_catalogo_unique
  ON inversores_catalogo (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'), lower(trim(fabricante)), lower(trim(modelo)));

CREATE UNIQUE INDEX IF NOT EXISTS idx_baterias_unique
  ON baterias (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'), lower(trim(fabricante)), lower(trim(modelo)));