WITH closed AS (
  UPDATE wa_outbox
  SET status = 'failed_final',
      error_message = COALESCE(error_message,'') || ' | encerrado_por_seguranca_24h',
      updated_at = now()
  WHERE status IN ('failed','pending')
    AND created_at < now() - interval '24 hours'
  RETURNING id, tenant_id, instance_id, error_message
)
INSERT INTO wa_ops_events (tenant_id, instance_id, event_type, payload)
SELECT tenant_id, instance_id, 'outbox_closed_safety',
       jsonb_build_object('outbox_id', id, 'reason', 'erro_antigo_nao_reenviado_por_segurança')
FROM closed;

UPDATE proposal_message_logs
SET status = 'failed_final',
    erro = COALESCE(erro,'') || ' | encerrado_por_seguranca_24h'
WHERE status = 'failed'
  AND created_at < now() - interval '24 hours';