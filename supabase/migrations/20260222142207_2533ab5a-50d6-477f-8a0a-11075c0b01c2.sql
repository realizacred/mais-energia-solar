
-- Clean up duplicate guard triggers on audit_logs (keep canonical names only)
DROP TRIGGER IF EXISTS guard_audit_insert ON public.audit_logs;
DROP TRIGGER IF EXISTS prevent_audit_delete ON public.audit_logs;
DROP TRIGGER IF EXISTS prevent_audit_update ON public.audit_logs;
-- Remaining (canonical): guard_audit_log_insert, prevent_audit_log_delete, prevent_audit_log_update
