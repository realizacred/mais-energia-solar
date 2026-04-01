-- Deduplicar modulos_solares (4 duplicatas case-insensitive)
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'), lower(trim(fabricante)), lower(trim(modelo)), potencia_wp
           ORDER BY
             (
               (CASE WHEN eficiencia_percent IS NOT NULL THEN 1 ELSE 0 END) +
               (CASE WHEN voc_v IS NOT NULL THEN 1 ELSE 0 END) +
               (CASE WHEN isc_a IS NOT NULL THEN 1 ELSE 0 END) +
               (CASE WHEN vmp_v IS NOT NULL THEN 1 ELSE 0 END) +
               (CASE WHEN imp_a IS NOT NULL THEN 1 ELSE 0 END) +
               (CASE WHEN datasheet_url IS NOT NULL THEN 1 ELSE 0 END)
             ) DESC,
             created_at DESC NULLS LAST,
             id DESC
         ) AS rn
  FROM modulos_solares
)
DELETE FROM modulos_solares ms
USING ranked r
WHERE ms.id = r.id AND r.rn > 1;

-- Unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_modulos_solares_unique
  ON modulos_solares (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'), lower(trim(fabricante)), lower(trim(modelo)), potencia_wp);

CREATE UNIQUE INDEX IF NOT EXISTS idx_otimizadores_catalogo_unique
  ON otimizadores_catalogo (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'), lower(trim(fabricante)), lower(trim(modelo)));