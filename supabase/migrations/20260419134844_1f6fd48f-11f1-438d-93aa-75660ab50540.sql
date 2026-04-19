
-- 1) RISCO#5: alinhar sm_project_id em propostas_nativas para bigint (canônico)
-- Limpar valores não-numéricos (não deve haver, mas defensivo)
UPDATE public.propostas_nativas
   SET sm_project_id = NULL
 WHERE sm_project_id IS NOT NULL
   AND sm_project_id !~ '^\d+$';

ALTER TABLE public.propostas_nativas
  ALTER COLUMN sm_project_id TYPE bigint
  USING NULLIF(sm_project_id, '')::bigint;

CREATE INDEX IF NOT EXISTS idx_propostas_nativas_sm_project_id
  ON public.propostas_nativas (tenant_id, sm_project_id)
  WHERE sm_project_id IS NOT NULL;

-- 2) CR#3: finalizar job preso atual (sem heartbeat há mais de 30 min)
UPDATE public.migration_jobs
   SET status = 'failed',
       completed_at = now(),
       error_message = COALESCE(error_message, '') || ' [auto: stalled — sem heartbeat]'
 WHERE status = 'running'
   AND id = '01eaa551-8241-408e-a9c0-b36bee7f08fc';

-- 3) CR#3: função utilitária para auto-failar jobs travados (chamável por cron ou manualmente)
CREATE OR REPLACE FUNCTION public.fail_stalled_migration_jobs(p_stall_minutes int DEFAULT 10)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  WITH updated AS (
    UPDATE public.migration_jobs mj
       SET status = 'failed',
           completed_at = now(),
           error_message = COALESCE(mj.error_message, '') ||
             format(' [auto-failed: sem heartbeat há mais de %s min]', p_stall_minutes)
     WHERE mj.status = 'running'
       AND COALESCE(
             (mj.metadata->>'last_heartbeat_at')::timestamptz,
             mj.started_at
           ) < (now() - make_interval(mins => p_stall_minutes))
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.fail_stalled_migration_jobs(int) FROM public;
GRANT EXECUTE ON FUNCTION public.fail_stalled_migration_jobs(int) TO service_role;
