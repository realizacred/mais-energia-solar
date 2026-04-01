-- Deduplicar inversores_catalogo
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'), lower(trim(fabricante)), lower(trim(modelo))
           ORDER BY
             (
               (CASE WHEN eficiencia_max_percent IS NOT NULL THEN 1 ELSE 0 END) +
               (CASE WHEN tensao_entrada_max_v IS NOT NULL THEN 1 ELSE 0 END) +
               (CASE WHEN corrente_entrada_max_a IS NOT NULL THEN 1 ELSE 0 END) +
               (CASE WHEN mppt_count IS NOT NULL THEN 1 ELSE 0 END) +
               (CASE WHEN tensao_mppt_min_v IS NOT NULL THEN 1 ELSE 0 END) +
               (CASE WHEN tensao_mppt_max_v IS NOT NULL THEN 1 ELSE 0 END) +
               (CASE WHEN corrente_saida_a IS NOT NULL THEN 1 ELSE 0 END) +
               (CASE WHEN peso_kg IS NOT NULL THEN 1 ELSE 0 END) +
               (CASE WHEN datasheet_url IS NOT NULL THEN 1 ELSE 0 END)
             ) DESC,
             created_at DESC NULLS LAST,
             id DESC
         ) AS rn
  FROM inversores_catalogo
)
DELETE FROM inversores_catalogo ic
USING ranked r
WHERE ic.id = r.id AND r.rn > 1;

-- Deduplicar baterias
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'), lower(trim(fabricante)), lower(trim(modelo))
           ORDER BY
             (
               (CASE WHEN energia_kwh IS NOT NULL THEN 1 ELSE 0 END) +
               (CASE WHEN tensao_nominal_v IS NOT NULL THEN 1 ELSE 0 END) +
               (CASE WHEN potencia_max_saida_kw IS NOT NULL THEN 1 ELSE 0 END)
             ) DESC,
             created_at DESC NULLS LAST,
             id DESC
         ) AS rn
  FROM baterias
)
DELETE FROM baterias b
USING ranked r
WHERE b.id = r.id AND r.rn > 1;

-- Deduplicar modulos_solares
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