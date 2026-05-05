UPDATE wa_conversations c
SET cliente_nome = NULL
FROM wa_instances i
WHERE c.instance_id = i.id
  AND c.is_group = false
  AND i.profile_name IS NOT NULL
  AND lower(trim(c.cliente_nome)) = lower(trim(i.profile_name));