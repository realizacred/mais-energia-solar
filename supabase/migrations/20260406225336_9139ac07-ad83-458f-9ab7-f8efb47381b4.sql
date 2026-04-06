
-- 1. Melhorar purge_old_payloads com batch maior e solar_market cleanup
CREATE OR REPLACE FUNCTION public.purge_old_payloads()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payloads_deleted bigint := 0;
  v_webhooks_deleted bigint := 0;
  v_outbox_deleted bigint := 0;
  v_smp_deleted bigint := 0;
  v_batch_size int := 5000;
  v_deleted int;
BEGIN
  -- 1. Payloads de provider (7 dias) — batched
  LOOP
    DELETE FROM monitor_provider_payloads
    WHERE ctid IN (
      SELECT ctid FROM monitor_provider_payloads
      WHERE received_at < NOW() - INTERVAL '7 days'
      LIMIT v_batch_size
    );
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    v_payloads_deleted := v_payloads_deleted + v_deleted;
    EXIT WHEN v_deleted < v_batch_size;
    PERFORM pg_sleep(0.1);
  END LOOP;

  -- 2. Webhook events processados (14 dias) — batched
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
    PERFORM pg_sleep(0.1);
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
    PERFORM pg_sleep(0.1);
  END LOOP;

  -- 4. wa_webhook_events não processados antigos (30 dias) — cleanup de stuck
  DELETE FROM wa_webhook_events
  WHERE created_at < NOW() - INTERVAL '30 days'
    AND processed = false;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_webhooks_deleted := v_webhooks_deleted + v_deleted;

  RETURN jsonb_build_object(
    'payloads_deleted', v_payloads_deleted,
    'webhooks_deleted', v_webhooks_deleted,
    'outbox_deleted', v_outbox_deleted,
    'executed_at', NOW()
  );
END;
$$;

-- 2. Mudar cron de purge de semanal para diário às 3h
SELECT cron.unschedule(39);
SELECT cron.schedule(
  'purge-old-payloads-daily',
  '0 3 * * *',
  $$SELECT public.purge_old_payloads()$$
);

-- 3. Reduzir wa-bg-worker de 1min para 2min (job 12)
SELECT cron.unschedule(12);
SELECT cron.schedule(
  'wa-bg-worker-2min',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/wa-bg-worker',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJndWhja3FrcG56aXlrcGJ3YmV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NzgwNzQsImV4cCI6MjA4NjA1NDA3NH0.BQAdNsi05xoWHhYJnnvmW3MIwnm8gbXTqosCTe5Ykxw"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 4. Reduzir process-wa-outbox de 1min para 2min (job 27)
SELECT cron.unschedule(27);
SELECT cron.schedule(
  'process-wa-outbox-2min',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/process-wa-outbox',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'cronkey2026maisenergia9X4kL7'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 5. Reduzir wa-instance-watchdog de 5min para 15min (job 24)
SELECT cron.unschedule(24);
SELECT cron.schedule(
  'wa-instance-watchdog-15min',
  '*/15 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/wa-instance-watchdog',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-cron-secret','cronkey2026maisenergia9X4kL7'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- 6. Remover tuya-proxy duplicado (job 38 é redundante com 37)
SELECT cron.unschedule(38);
