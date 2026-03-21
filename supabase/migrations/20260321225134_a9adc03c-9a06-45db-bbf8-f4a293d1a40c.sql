-- =============================================================
-- EMAIL MODULE — email_accounts, email_ingestion_rules/runs/messages
-- =============================================================

-- 1. email_accounts
CREATE TABLE IF NOT EXISTS public.email_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email_address text NOT NULL,
  provider_type text NOT NULL DEFAULT 'gmail' CHECK (provider_type IN ('gmail', 'imap')),
  account_role text NOT NULL DEFAULT 'invoices' CHECK (account_role IN ('invoices', 'operational', 'support')),
  host text,
  port integer,
  username text,
  is_active boolean NOT NULL DEFAULT true,
  can_read boolean NOT NULL DEFAULT true,
  can_send boolean NOT NULL DEFAULT false,
  last_sync_at timestamptz,
  last_error text,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_accounts_tenant ON public.email_accounts(tenant_id);
CREATE INDEX idx_email_accounts_active ON public.email_accounts(tenant_id, is_active) WHERE is_active = true;

ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_accounts_tenant_select" ON public.email_accounts
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "email_accounts_tenant_insert" ON public.email_accounts
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "email_accounts_tenant_update" ON public.email_accounts
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "email_accounts_tenant_delete" ON public.email_accounts
  FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- 2. email_ingestion_rules
CREATE TABLE IF NOT EXISTS public.email_ingestion_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email_account_id uuid NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  concessionaria_id uuid,
  sender_contains text,
  subject_contains text,
  has_attachment boolean DEFAULT true,
  allowed_extensions text[] DEFAULT ARRAY['pdf'],
  folder_name text DEFAULT 'INBOX',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_ingestion_rules_account ON public.email_ingestion_rules(email_account_id);

ALTER TABLE public.email_ingestion_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_ingestion_rules_tenant_all" ON public.email_ingestion_rules
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- 3. email_ingestion_runs
CREATE TABLE IF NOT EXISTS public.email_ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email_account_id uuid NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  processed_count integer NOT NULL DEFAULT 0,
  imported_count integer NOT NULL DEFAULT 0,
  duplicate_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX idx_email_ingestion_runs_account ON public.email_ingestion_runs(email_account_id);
CREATE INDEX idx_email_ingestion_runs_tenant ON public.email_ingestion_runs(tenant_id);

ALTER TABLE public.email_ingestion_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_ingestion_runs_tenant_all" ON public.email_ingestion_runs
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- 4. email_ingestion_messages
CREATE TABLE IF NOT EXISTS public.email_ingestion_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES public.email_ingestion_runs(id) ON DELETE CASCADE,
  external_message_id text,
  sender text,
  subject text,
  received_at timestamptz,
  attachment_count integer DEFAULT 0,
  result_status text NOT NULL DEFAULT 'pending' CHECK (result_status IN ('pending', 'imported', 'duplicate', 'failed', 'skipped')),
  invoice_import_job_id uuid,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_ingestion_messages_run ON public.email_ingestion_messages(run_id);
CREATE INDEX idx_email_ingestion_messages_ext ON public.email_ingestion_messages(tenant_id, external_message_id);

ALTER TABLE public.email_ingestion_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_ingestion_messages_tenant_all" ON public.email_ingestion_messages
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());