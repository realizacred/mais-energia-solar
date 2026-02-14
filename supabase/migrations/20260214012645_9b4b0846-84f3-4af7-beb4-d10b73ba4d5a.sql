
-- P0-2: Advisory lock RPCs for process-webhook-events (same pattern as existing try_followup_lock/release_followup_lock)

CREATE OR REPLACE FUNCTION public.try_webhook_lock()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN pg_try_advisory_lock(hashtext('process-webhook-events'));
END;
$function$;

CREATE OR REPLACE FUNCTION public.release_webhook_lock()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM pg_advisory_unlock(hashtext('process-webhook-events'));
END;
$function$;
