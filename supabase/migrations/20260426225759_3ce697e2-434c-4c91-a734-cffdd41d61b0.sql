-- 1) Cancela jobs SM órfãos travados (running sem heartbeat há > 3 min OU sem started_at)
UPDATE public.solarmarket_promotion_jobs
SET status = 'cancelled',
    finished_at = COALESCE(finished_at, now()),
    error_summary = COALESCE(error_summary::jsonb, '{}'::jsonb) || jsonb_build_object(
      'auto_cancel', true,
      'reason', 'orphan_no_heartbeat',
      'cancelled_at', now()::text
    )
WHERE status = 'running'
  AND (
    last_step_at IS NULL
    OR last_step_at < now() - interval '3 minutes'
  );

-- 2) Atualiza/cria função de auto-cancelamento de jobs SM órfãos (estende a existente sm_resume_stuck_imports)
CREATE OR REPLACE FUNCTION public.sm_cancel_orphan_promotion_jobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cancelled_count integer;
BEGIN
  WITH upd AS (
    UPDATE public.solarmarket_promotion_jobs
    SET status = 'cancelled',
        finished_at = now(),
        error_summary = COALESCE(error_summary::jsonb, '{}'::jsonb) || jsonb_build_object(
          'auto_cancel', true,
          'reason', 'orphan_no_heartbeat',
          'cancelled_at', now()::text
        )
    WHERE status = 'running'
      AND (
        last_step_at IS NULL AND started_at < now() - interval '3 minutes'
        OR last_step_at IS NOT NULL AND last_step_at < now() - interval '5 minutes'
      )
    RETURNING id
  )
  SELECT COUNT(*) INTO cancelled_count FROM upd;
  RETURN cancelled_count;
END;
$$;

-- 3) Agenda cron para rodar a cada 2 min
SELECT cron.unschedule('sm_cancel_orphan_promotion_jobs')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sm_cancel_orphan_promotion_jobs');

SELECT cron.schedule(
  'sm_cancel_orphan_promotion_jobs',
  '*/2 * * * *',
  $$ SELECT public.sm_cancel_orphan_promotion_jobs(); $$
);