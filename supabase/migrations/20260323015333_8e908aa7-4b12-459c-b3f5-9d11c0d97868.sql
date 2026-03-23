
-- Add missing columns to email_accounts for IMAP/Gmail management
ALTER TABLE public.email_accounts
  ADD COLUMN IF NOT EXISTS nome text,
  ADD COLUMN IF NOT EXISTS imap_password_encrypted text,
  ADD COLUMN IF NOT EXISTS verificar_a_cada_minutos integer DEFAULT 60,
  ADD COLUMN IF NOT EXISTS pasta_monitorada text DEFAULT 'INBOX',
  ADD COLUMN IF NOT EXISTS filtro_remetente text,
  ADD COLUMN IF NOT EXISTS gmail_credentials jsonb,
  ADD COLUMN IF NOT EXISTS gmail_settings jsonb;

-- Update existing RLS policy to use current_tenant_id()
DROP POLICY IF EXISTS "email_accounts_tenant_all" ON public.email_accounts;
DROP POLICY IF EXISTS "tenant_isolation" ON public.email_accounts;

CREATE POLICY "email_accounts_tenant_all" ON public.email_accounts
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
