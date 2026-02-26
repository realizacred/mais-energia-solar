
-- Background job queue for WhatsApp async tasks
CREATE TABLE public.wa_bg_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL,
  job_type TEXT NOT NULL CHECK (job_type IN ('media_fetch','group_name','profile_pic','push','auto_assign','auto_reply','enrich')),
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','done','failed')),
  attempts SMALLINT NOT NULL DEFAULT 0,
  next_run_at TIMESTAMPTZ DEFAULT now(),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Idempotency: one job per message+type
  idempotency_key TEXT UNIQUE
);

-- Indexes for worker polling
CREATE INDEX idx_wa_bg_jobs_pending ON public.wa_bg_jobs (status, next_run_at) WHERE status IN ('pending', 'failed');
CREATE INDEX idx_wa_bg_jobs_tenant ON public.wa_bg_jobs (tenant_id);
CREATE INDEX idx_wa_bg_jobs_created ON public.wa_bg_jobs (created_at);

-- Enable RLS
ALTER TABLE public.wa_bg_jobs ENABLE ROW LEVEL SECURITY;

-- RLS: only service role should access this table (via edge functions)
CREATE POLICY "Service role full access on wa_bg_jobs"
  ON public.wa_bg_jobs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_wa_bg_jobs_updated_at
  BEFORE UPDATE ON public.wa_bg_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
