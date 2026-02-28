
-- 1) Add legacy_key to deals for idempotent migration
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS legacy_key TEXT;

-- Unique constraint per tenant (partial: only non-null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_deals_tenant_legacy_key
  ON public.deals (tenant_id, legacy_key) WHERE legacy_key IS NOT NULL;

-- 2) Migration log table
CREATE TABLE IF NOT EXISTS public.sm_migration_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  sm_proposal_id INTEGER NOT NULL,
  sm_client_name TEXT,
  status TEXT NOT NULL CHECK (status IN ('SUCCESS','SKIP','CONFLICT','ERROR','WOULD_CREATE','WOULD_LINK','WOULD_SKIP')),
  payload JSONB DEFAULT '{}',
  is_dry_run BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sm_migration_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage migration logs"
  ON public.sm_migration_log FOR ALL
  USING (tenant_id = public.current_tenant_id());

CREATE INDEX IF NOT EXISTS idx_sm_migration_log_tenant_proposal
  ON public.sm_migration_log (tenant_id, sm_proposal_id);
