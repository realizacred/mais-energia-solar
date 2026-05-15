CREATE OR REPLACE FUNCTION public.try_webhook_lock_v2()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN pg_try_advisory_lock(hashtext('process-webhook-events-v2'));
END;
$function$;

CREATE OR REPLACE FUNCTION public.release_webhook_lock_v2()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN pg_advisory_unlock(hashtext('process-webhook-events-v2'));
END;
$function$;
