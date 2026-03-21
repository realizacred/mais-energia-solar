-- Função de purge para tabelas de payloads grandes
-- monitor_provider_payloads: retenção 7 dias
-- wa_webhook_events: retenção 14 dias (só processados)

CREATE OR REPLACE FUNCTION public.purge_old_payloads()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payloads_deleted bigint;
  v_webhooks_deleted bigint;
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

  RETURN jsonb_build_object(
    'payloads_deleted', v_payloads_deleted,
    'webhooks_deleted', v_webhooks_deleted,
    'executed_at', NOW()
  );
END;
$$;