DO $$
DECLARE
  v_tenant uuid := '17de8315-2e2f-4a79-8751-e5d507d69a41'::uuid;
BEGIN
  UPDATE public.solarmarket_promotion_jobs
     SET status = 'cancelled',
         finished_at = now(),
         updated_at = now(),
         error_summary = jsonb_build_object(
           'reason', 'manual_repair_stale_running_subjob',
           'repaired_at', now()
         )::text
   WHERE tenant_id = v_tenant
     AND status = 'running'
     AND job_type = 'promote-all'
     AND last_step_at < now() - interval '2 minutes';

  UPDATE public.solarmarket_promotion_jobs
     SET status = 'cancelled',
         finished_at = now(),
         updated_at = now(),
         metadata = COALESCE(metadata, '{}'::jsonb) - 'step_lock_until' - 'step_lock_acquired_at',
         error_summary = jsonb_build_object(
           'reason', 'manual_repair_stale_master_job',
           'repaired_at', now(),
           'action', 'retomar_pela_tela'
         )::text
   WHERE tenant_id = v_tenant
     AND status = 'running'
     AND job_type = 'migrate-chunked'
     AND last_step_at < now() - interval '2 minutes';
END $$;