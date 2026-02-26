-- Reset stuck group outbox items so they retry with the fixed logic
UPDATE wa_outbox 
SET status = 'pending', retry_count = 0, error_message = NULL 
WHERE remote_jid LIKE '%@g.us' AND status IN ('pending', 'failed') AND retry_count > 0;