ALTER TABLE public.solarmarket_promotion_jobs
  DROP CONSTRAINT IF EXISTS spj_job_type_check;

ALTER TABLE public.solarmarket_promotion_jobs
  ADD CONSTRAINT spj_job_type_check
  CHECK (job_type = ANY (ARRAY['promote-all'::text, 'promote-job'::text, 'promote-single'::text, 'migrate-chunked'::text]));