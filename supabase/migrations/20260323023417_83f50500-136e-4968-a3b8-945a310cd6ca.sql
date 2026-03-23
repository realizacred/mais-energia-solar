
-- Adicionar colunas OAuth ao site_settings
ALTER TABLE site_settings 
  ADD COLUMN IF NOT EXISTS google_client_id text,
  ADD COLUMN IF NOT EXISTS google_client_secret text,
  ADD COLUMN IF NOT EXISTS google_redirect_uri text 
    DEFAULT 'https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/gmail-oauth';

-- Contas Gmail conectadas (múltiplas por tenant)
CREATE TABLE IF NOT EXISTS gmail_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  nome text NOT NULL,
  email text,
  concessionaria_nome text,
  credentials jsonb,
  settings jsonb,
  is_active boolean DEFAULT true,
  verificar_a_cada_minutos integer DEFAULT 60,
  ultimo_verificado_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE gmail_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gmail_accounts_tenant_isolation" ON gmail_accounts
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- Migrar conta Gmail existente
INSERT INTO gmail_accounts (tenant_id, nome, email, credentials, settings, is_active)
SELECT 
  tenant_id,
  'Gmail Principal' as nome,
  settings->>'email' as email,
  credentials,
  settings,
  is_active
FROM integrations_api_configs
WHERE provider = 'gmail' AND is_active = true
ON CONFLICT DO NOTHING;
