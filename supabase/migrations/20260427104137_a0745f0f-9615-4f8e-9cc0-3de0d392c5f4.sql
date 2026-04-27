CREATE OR REPLACE FUNCTION public.sm_cancel_orphan_promotion_jobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cancelled_count integer;
BEGIN
  /*
    A migração principal (job_type='migrate-chunked') é recuperável pelo
    sm_resume_stuck_migrations. Cancelá-la por last_step_at antigo gera falso
    positivo de "orphan_no_heartbeat" quando o auto-encadeamento/pg_net atrasa.

    Mantemos cancelamento apenas para jobs auxiliares realmente órfãos:
    - subjobs promote-all sem heartbeat, antigos o suficiente para não estarem vivos;
    - jobs sem started_at/heartbeat claramente abandonados.
  */
  WITH upd AS (
    UPDATE public.solarmarket_promotion_jobs
    SET status = 'cancelled',
        finished_at = now(),
        updated_at = now(),
        error_summary = COALESCE(error_summary::jsonb, '{}'::jsonb) || jsonb_build_object(
          'auto_cancel', true,
          'reason', 'orphan_no_heartbeat',
          'cancelled_at', now()::text
        )
    WHERE status = 'running'
      AND job_type <> 'migrate-chunked'
      AND (
        (last_step_at IS NULL AND COALESCE(started_at, created_at) < now() - interval '10 minutes')
        OR (last_step_at IS NOT NULL AND last_step_at < now() - interval '15 minutes')
      )
    RETURNING id
  )
  SELECT COUNT(*) INTO cancelled_count FROM upd;

  RETURN cancelled_count;
END;
$$;

REVOKE ALL ON FUNCTION public.sm_cancel_orphan_promotion_jobs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sm_cancel_orphan_promotion_jobs() TO service_role;