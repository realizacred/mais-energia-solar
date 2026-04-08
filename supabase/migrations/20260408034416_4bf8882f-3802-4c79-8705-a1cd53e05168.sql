
-- 1. Add nome_kit field to propostas_nativas
ALTER TABLE propostas_nativas ADD COLUMN IF NOT EXISTS nome_kit text;

-- 2. Create proposta_grupo_tokens table
CREATE TABLE IF NOT EXISTS proposta_grupo_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES projetos(id),
  proposta_ids uuid[] NOT NULL,
  titulo text,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(user_id),
  view_count integer DEFAULT 0,
  kit_aceito_id uuid REFERENCES propostas_nativas(id)
);

-- 3. RLS
ALTER TABLE proposta_grupo_tokens ENABLE ROW LEVEL SECURITY;

-- Public read via valid token (anon + authenticated)
CREATE POLICY "Public read via valid token"
  ON proposta_grupo_tokens
  FOR SELECT
  TO anon, authenticated
  USING (
    (expires_at IS NULL OR expires_at > now())
  );

-- Tenant members can manage their own grupo tokens
CREATE POLICY "Tenant members can manage grupo tokens"
  ON proposta_grupo_tokens
  FOR ALL
  TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_proposta_grupo_tokens_token ON proposta_grupo_tokens(token);
CREATE INDEX IF NOT EXISTS idx_proposta_grupo_tokens_projeto ON proposta_grupo_tokens(projeto_id);
