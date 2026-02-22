
-- Fix: remove duplicate/broken audit trigger that causes INSERT error
-- audit_row_change does NOT set app.audit_trigger_active and uses wrong column names
-- The correct trigger (audit_propostas_nativas → audit_log_trigger_fn) already handles auditing

DROP TRIGGER IF EXISTS trg_audit_propostas_nativas ON public.propostas_nativas;

-- Also check and remove audit_row_change from other tables if it exists
-- (it would cause the same error on any table it's attached to)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT tgname, tgrelid::regclass AS table_name
    FROM pg_trigger 
    WHERE tgfoid = 'audit_row_change'::regproc
    AND NOT tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %s', r.tgname, r.table_name);
    RAISE LOG 'Dropped broken audit_row_change trigger % on %', r.tgname, r.table_name;
  END LOOP;
END $$;
