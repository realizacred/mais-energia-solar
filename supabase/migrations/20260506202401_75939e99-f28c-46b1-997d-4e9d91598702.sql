
-- Unschedule if already exists, then schedule
DO $$
DECLARE
  v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'subscription-lifecycle-hourly';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
END $$;

SELECT cron.schedule(
  'subscription-lifecycle-hourly',
  '0 * * * *',
  $$ SELECT public.run_subscription_lifecycle(); $$
);
