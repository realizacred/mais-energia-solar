
-- Table to log cron job executions
CREATE TABLE public.cron_execution_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed')),
  duration_ms INTEGER,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  tenant_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups by job name and recency
CREATE INDEX idx_cron_exec_logs_job_started ON public.cron_execution_logs (job_name, started_at DESC);
CREATE INDEX idx_cron_exec_logs_status ON public.cron_execution_logs (status) WHERE status = 'failed';

-- Enable RLS
ALTER TABLE public.cron_execution_logs ENABLE ROW LEVEL SECURITY;

-- Admin-only read policy (uses has_role helper)
CREATE POLICY "Admins can view cron logs"
  ON public.cron_execution_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Service role insert (edge functions use service_role key)
CREATE POLICY "Service can insert cron logs"
  ON public.cron_execution_logs
  FOR INSERT
  WITH CHECK (true);

-- Cleanup: auto-delete logs older than 30 days
CREATE OR REPLACE FUNCTION public.cleanup_old_cron_logs()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.cron_execution_logs
  WHERE created_at < now() - interval '30 days';
$$;
