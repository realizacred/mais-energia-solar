ALTER TABLE wa_outbox DROP CONSTRAINT IF EXISTS wa_outbox_status_check;
ALTER TABLE wa_outbox ADD CONSTRAINT wa_outbox_status_check
  CHECK (status = ANY (ARRAY['pending'::text,'sending'::text,'sent'::text,'failed'::text,'failed_final'::text,'cancelled'::text,'skipped'::text]));

ALTER TABLE proposal_message_logs DROP CONSTRAINT IF EXISTS proposal_message_logs_status_check;
ALTER TABLE proposal_message_logs ADD CONSTRAINT proposal_message_logs_status_check
  CHECK (status = ANY (ARRAY['pending'::text,'sent'::text,'failed'::text,'failed_final'::text]));