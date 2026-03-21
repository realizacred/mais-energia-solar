-- 1) Resolve stuck message
UPDATE wa_outbox 
SET status = 'failed',
    error_message = 'Timeout — mensagem ficou em sending por mais de 4 dias sem completar',
    updated_at = NOW()
WHERE id = 'a07e31b7-2249-4a8c-82e9-0d75715b6908'
AND status = 'sending';

-- 2) Add wa_outbox purge to existing function
CREATE OR REPLACE FUNCTION purge_old_payloads()
RETURNS jsonb AS $$
DECLARE
  v_payloads_deleted bigint;
  v_webhooks_deleted bigint;
  v_outbox_deleted bigint;
BEGIN
  -- Manter apenas últimos 7 dias de payloads de provider (audit trail)
  DELETE FROM monitor_provider_payloads
  WHERE received_at < NOW() - INTERVAL '7 days';
  GET DIAGNOSTICS v_payloads_deleted = ROW_COUNT;

  -- Manter apenas últimos 14 dias de webhook events processados
  DELETE FROM wa_webhook_events
  WHERE created_at < NOW() - INTERVAL '14 days'
    AND processed = true;
  GET DIAGNOSTICS v_webhooks_deleted = ROW_COUNT;

  -- Manter apenas últimos 30 dias de wa_outbox sent/failed
  DELETE FROM wa_outbox
  WHERE status IN ('sent', 'failed')
  AND created_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS v_outbox_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'payloads_deleted', v_payloads_deleted,
    'webhooks_deleted', v_webhooks_deleted,
    'outbox_deleted', v_outbox_deleted,
    'executed_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;