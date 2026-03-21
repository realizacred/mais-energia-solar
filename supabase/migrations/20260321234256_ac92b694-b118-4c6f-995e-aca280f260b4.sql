-- Create planos_servico table
CREATE TABLE IF NOT EXISTS planos_servico (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  valor NUMERIC(10,2) NOT NULL,
  tipo TEXT DEFAULT 'monitoramento',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE planos_servico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_planos_servico"
ON planos_servico
FOR ALL
TO authenticated
USING (tenant_id = public.current_tenant_id())
WITH CHECK (tenant_id = public.current_tenant_id());

-- Add billing columns to units_consumidoras
ALTER TABLE units_consumidoras
ADD COLUMN IF NOT EXISTS plano_servico_id UUID REFERENCES planos_servico(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS valor_mensalidade NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS dia_vencimento INT DEFAULT 10,
ADD COLUMN IF NOT EXISTS servico_cobranca_ativo BOOLEAN DEFAULT false;

-- Index for billing queries
CREATE INDEX IF NOT EXISTS idx_uc_servico_cobranca ON units_consumidoras (servico_cobranca_ativo) WHERE servico_cobranca_ativo = true;