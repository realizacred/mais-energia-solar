-- Fix inconsistent papel_gd for UCs that are gd_geradora
UPDATE units_consumidoras
SET papel_gd = 'geradora', updated_at = now()
WHERE tipo_uc = 'gd_geradora'
AND papel_gd = 'none';