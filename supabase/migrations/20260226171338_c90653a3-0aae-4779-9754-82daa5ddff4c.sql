
-- Retroactively fix outbound messages stuck at 'sent' that have already received
-- DELIVERY_ACK or READ webhooks (processed before the status hierarchy fix was deployed)

-- Step 1: Update messages that should be 'read'
UPDATE wa_messages
SET status = 'read'
WHERE id IN (
  SELECT DISTINCT m.id
  FROM wa_messages m
  JOIN wa_webhook_events e ON e.payload->'data'->>'keyId' = m.evolution_message_id
  WHERE m.status = 'sent'
    AND m.direction = 'out'
    AND e.event_type = 'messages.update'
    AND e.processed = true
    AND e.payload->'data'->>'status' IN ('READ', 'PLAYED')
);

-- Step 2: Update messages that should be 'delivered' (but not already read)
UPDATE wa_messages
SET status = 'delivered'
WHERE id IN (
  SELECT DISTINCT m.id
  FROM wa_messages m
  JOIN wa_webhook_events e ON e.payload->'data'->>'keyId' = m.evolution_message_id
  WHERE m.status = 'sent'
    AND m.direction = 'out'
    AND e.event_type = 'messages.update'
    AND e.processed = true
    AND e.payload->'data'->>'status' = 'DELIVERY_ACK'
);
