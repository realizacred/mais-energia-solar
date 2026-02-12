-- 1) Remove duplicatas mantendo apenas o registro mais antigo de cada combinação
DELETE FROM meta_notifications
WHERE id NOT IN (
  SELECT DISTINCT ON (vendedor_id, mes, ano, tipo_meta, percentual_atingido) id
  FROM meta_notifications
  ORDER BY vendedor_id, mes, ano, tipo_meta, percentual_atingido, created_at ASC
);

-- 2) Criar unique constraint para impedir duplicatas futuras
ALTER TABLE meta_notifications
ADD CONSTRAINT meta_notifications_unique_per_vendedor_meta
UNIQUE (vendedor_id, mes, ano, tipo_meta, percentual_atingido);