
-- Backfill P0: wa_messages com tenant_id NULL
UPDATE wa_messages m
SET tenant_id = c.tenant_id
FROM wa_conversations c
WHERE c.id = m.conversation_id
  AND m.tenant_id IS NULL
  AND c.tenant_id IS NOT NULL;

-- Backfill P0: wa_outbox com tenant_id NULL
UPDATE wa_outbox o
SET tenant_id = c.tenant_id
FROM wa_conversations c
WHERE c.id = o.conversation_id
  AND o.tenant_id IS NULL
  AND c.tenant_id IS NOT NULL;

-- Backfill P0: user_roles com tenant_id NULL
UPDATE user_roles ur
SET tenant_id = p.tenant_id
FROM profiles p
WHERE p.user_id = ur.user_id
  AND ur.tenant_id IS NULL
  AND p.tenant_id IS NOT NULL;
