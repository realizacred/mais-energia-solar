CREATE OR REPLACE FUNCTION public.sm_resume_stuck_imports()
RETURNS TABLE(job_id uuid, dispatched boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  rec RECORD;
  fn_url text := 'https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/solarmarket-import';
BEGIN
  FOR rec IN
    SELECT id, tenant_id, triggered_by, scope, current_step, updated_at
      FROM public.solarmarket_import_jobs
     WHERE status = 'running'
       AND updated_at < now() - interval '5 minutes'
     ORDER BY updated_at ASC
     LIMIT 5
  LOOP
    -- Heartbeat antes do dispatch para evitar disparos duplicados enquanto a Edge Function inicia.
    UPDATE public.solarmarket_import_jobs
       SET updated_at = now()
     WHERE id = rec.id
       AND status = 'running';

    -- Logging nunca pode bloquear a retomada do job.
    BEGIN
      INSERT INTO public.solarmarket_import_logs (
        job_id,
        tenant_id,
        entity_type,
        external_id,
        internal_id,
        action,
        error_message,
        payload_snippet,
        severity,
        error_code,
        error_origin
      ) VALUES (
        rec.id,
        rec.tenant_id,
        'job',
        rec.id::text,
        rec.id,
        'updated',
        '[cron_resume] Retomada automática disparada para importação SolarMarket parada há mais de 5 minutos.',
        jsonb_build_object(
          'current_step', rec.current_step,
          'stale_updated_at', rec.updated_at,
          'cron_job', 'sm_resume_stuck_imports'
        ),
        'info',
        'SM_IMPORT_CRON_RESUME',
        'system'
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'sm_resume_stuck_imports: failed to write resume log for job %: %', rec.id, SQLERRM;
    END;

    PERFORM net.http_post(
      url := fn_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-sm-cron-secret', 'sm-resume-cron-v1'
      ),
      body := jsonb_build_object(
        'action', 'process-job',
        'job_id', rec.id,
        'tenant_id', rec.tenant_id,
        'triggered_by', rec.triggered_by,
        'scope', rec.scope
      )
    );

    job_id := rec.id;
    dispatched := true;
    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$;