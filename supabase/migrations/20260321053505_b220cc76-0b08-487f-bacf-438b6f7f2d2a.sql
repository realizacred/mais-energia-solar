
-- Drop and recreate with batched deletes to avoid statement timeout
CREATE OR REPLACE FUNCTION public.purge_old_payloads()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '120s'
AS $$
DECLARE
  v_payloads_deleted bigint := 0;
  v_webhooks_deleted bigint := 0;
  v_outbox_deleted bigint := 0;
  v_batch_size int := 1000;
  v_deleted int;
BEGIN
  -- 1. Payloads de provider (7 dias) — geralmente poucos, delete direto
  DELETE FROM monitor_provider_payloads
  WHERE received_at < NOW() - INTERVAL '7 days';
  GET DIAGNOSTICS v_payloads_deleted = ROW_COUNT;

  -- 2. Webhook events processados (14 dias) — batched para evitar timeout
  LOOP
    DELETE FROM wa_webhook_events
    WHERE id IN (
      SELECT id FROM wa_webhook_events
      WHERE created_at < NOW() - INTERVAL '14 days'
        AND processed = true
      LIMIT v_batch_size
    );
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    v_webhooks_deleted := v_webhooks_deleted + v_deleted;
    EXIT WHEN v_deleted < v_batch_size;
  END LOOP;

  -- 3. wa_outbox sent/failed (30 dias) — batched
  LOOP
    DELETE FROM wa_outbox
    WHERE id IN (
      SELECT id FROM wa_outbox
      WHERE status IN ('sent', 'failed')
        AND created_at < NOW() - INTERVAL '30 days'
      LIMIT v_batch_size
    );
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    v_outbox_deleted := v_outbox_deleted + v_deleted;
    EXIT WHEN v_deleted < v_batch_size;
  END LOOP;

  RETURN jsonb_build_object(
    'payloads_deleted', v_payloads_deleted,
    'webhooks_deleted', v_webhooks_deleted,
    'outbox_deleted', v_outbox_deleted,
    'executed_at', NOW()
  );
END;
$$;
