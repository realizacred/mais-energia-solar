-- Mark old events as processed to clear the queue bottleneck
UPDATE wa_webhook_events 
SET processed = true, 
    processed_at = now(),
    error = 'Manually cleared during incident recovery'
WHERE processed = false 
  AND created_at < '2026-05-15 13:00:00+00';
