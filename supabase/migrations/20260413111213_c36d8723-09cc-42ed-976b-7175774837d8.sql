
-- Table to persist migration config per tenant for cron auto-resume
CREATE TABLE IF NOT EXISTS public.sm_migration_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  pipeline_id uuid NOT NULL,
  stage_id uuid,
  owner_id uuid,
  auto_resolve_owner boolean NOT NULL DEFAULT true,
  batch_size int NOT NULL DEFAULT 10,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

ALTER TABLE public.sm_migration_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view their settings"
  ON public.sm_migration_settings FOR SELECT
  TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant members can upsert their settings"
  ON public.sm_migration_settings FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant members can update their settings"
  ON public.sm_migration_settings FOR UPDATE
  TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

-- Cron job: every 5 minutes, trigger migration for tenants with pending proposals
SELECT cron.schedule(
  'sm-migration-auto-resume',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1) || '/functions/v1/migrate-sm-proposals',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1)
    ),
    body := jsonb_build_object(
      'cron_mode', true
    )
  ) AS request_id;
  $$
);
