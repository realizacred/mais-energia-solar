-- Retry the failed Boleto.pdf to Bruno Bandeira now that process-wa-outbox
-- rewrites public wa-attachments URLs to signed URLs before sending.
INSERT INTO wa_outbox (
  tenant_id, instance_id, remote_jid, message_type, content,
  media_url, media_filename, conversation_id, message_id,
  idempotency_key, status, scheduled_at
)
SELECT
  tenant_id, instance_id, remote_jid, message_type, content,
  media_url, COALESCE(media_filename, content), conversation_id, message_id,
  'inbox_manual_retry:' || message_id || ':' || extract(epoch from now())::bigint,
  'pending', now()
FROM wa_outbox
WHERE message_id = 'ec0dd5ad-f353-486e-aa19-fa3ef8d69dd3'
ORDER BY created_at DESC
LIMIT 1;

UPDATE wa_messages
SET status = 'pending', error_message = NULL
WHERE id = 'ec0dd5ad-f353-486e-aa19-fa3ef8d69dd3';