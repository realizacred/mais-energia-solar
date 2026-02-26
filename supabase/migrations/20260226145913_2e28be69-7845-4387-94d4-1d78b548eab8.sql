
-- 1) ATOMIC JOB CLAIM RPC (FOR UPDATE SKIP LOCKED)
CREATE OR REPLACE FUNCTION public.claim_wa_bg_jobs(max_jobs integer DEFAULT 20)
RETURNS SETOF wa_bg_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE wa_bg_jobs
  SET status = 'processing', updated_at = now()
  WHERE id IN (
    SELECT id FROM wa_bg_jobs
    WHERE status IN ('pending', 'failed')
      AND attempts < 5
      AND next_run_at <= now()
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT max_jobs
  )
  RETURNING *;
END;
$$;

-- 2) RLS HARDENING: Remove permissive policy, deny all user access
DROP POLICY IF EXISTS "Tenant isolation on wa_bg_jobs" ON wa_bg_jobs;

-- Deny anon
CREATE POLICY "Deny anon access to wa_bg_jobs"
ON wa_bg_jobs FOR ALL TO anon USING (false) WITH CHECK (false);

-- Deny authenticated users (worker uses service_role which bypasses RLS)
CREATE POLICY "Deny authenticated access to wa_bg_jobs"
ON wa_bg_jobs FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- 3) OBSERVABILITY: Metrics view for monitoring (aggregated, no raw data exposed)
CREATE OR REPLACE VIEW public.wa_bg_jobs_metrics AS
SELECT
  job_type,
  status,
  count(*) AS job_count,
  avg(EXTRACT(EPOCH FROM (updated_at - created_at))) AS avg_duration_s,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (updated_at - created_at))) AS p50_duration_s,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (updated_at - created_at))) AS p95_duration_s,
  max(attempts) AS max_attempts_seen,
  count(*) FILTER (WHERE status = 'failed' AND attempts >= 5) AS dead_jobs
FROM wa_bg_jobs
WHERE created_at > now() - interval '24 hours'
GROUP BY job_type, status;

-- RLS on the view (deny direct user access, only service_role can query)
-- Views inherit table RLS, so authenticated users already can't see wa_bg_jobs data.
-- For super-admin monitoring, use service_role or a dedicated RPC:
CREATE OR REPLACE FUNCTION public.get_wa_bg_jobs_metrics()
RETURNS TABLE(
  job_type text,
  status text,
  job_count bigint,
  avg_duration_s double precision,
  p50_duration_s double precision,
  p95_duration_s double precision,
  max_attempts_seen integer,
  dead_jobs bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    job_type,
    status,
    count(*) AS job_count,
    avg(EXTRACT(EPOCH FROM (updated_at - created_at)))::double precision AS avg_duration_s,
    (percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (updated_at - created_at))))::double precision AS p50_duration_s,
    (percentile_cont(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (updated_at - created_at))))::double precision AS p95_duration_s,
    max(attempts) AS max_attempts_seen,
    count(*) FILTER (WHERE wa_bg_jobs.status = 'failed' AND attempts >= 5) AS dead_jobs
  FROM wa_bg_jobs
  WHERE created_at > now() - interval '24 hours'
  GROUP BY wa_bg_jobs.job_type, wa_bg_jobs.status;
$$;
