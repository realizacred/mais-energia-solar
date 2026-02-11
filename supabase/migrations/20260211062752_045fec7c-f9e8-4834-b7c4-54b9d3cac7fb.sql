-- Backfill orphaned non-group conversations: assign to first linked vendedor
-- This is a one-time data fix, not a schema change
UPDATE wa_conversations wc
SET assigned_to = sub.owner_user_id,
    updated_at = now()
FROM (
  SELECT wc2.id as conv_id,
    (SELECT v.user_id 
     FROM wa_instance_vendedores wiv 
     JOIN vendedores v ON v.id = wiv.vendedor_id 
     WHERE wiv.instance_id = wc2.instance_id 
     LIMIT 1) as owner_user_id
  FROM wa_conversations wc2
  WHERE wc2.assigned_to IS NULL 
    AND wc2.is_group = false
) sub
WHERE wc.id = sub.conv_id
  AND sub.owner_user_id IS NOT NULL;