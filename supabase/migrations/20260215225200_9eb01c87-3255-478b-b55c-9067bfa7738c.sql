
-- Remove overly permissive policies (writes happen via service_role in edge function)
DROP POLICY IF EXISTS "Service role can manage import jobs" ON public.solar_import_jobs;
DROP POLICY IF EXISTS "Service role can manage job logs" ON public.solar_import_job_logs;
