
-- Tabela de configuração de taxas de juros por forma de pagamento
CREATE TABLE public.payment_interest_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT (auth.uid()),
  forma_pagamento TEXT NOT NULL,
  juros_tipo TEXT NOT NULL DEFAULT 'sem_juros' CHECK (juros_tipo IN ('percentual', 'valor_fixo', 'sem_juros')),
  juros_valor NUMERIC NOT NULL DEFAULT 0,
  juros_responsavel TEXT NOT NULL DEFAULT 'cliente' CHECK (juros_responsavel IN ('empresa', 'cliente', 'nao_aplica')),
  parcelas_padrao INTEGER NOT NULL DEFAULT 1,
  intervalo_dias_padrao INTEGER NOT NULL DEFAULT 30,
  ativo BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, forma_pagamento)
);

-- RLS
ALTER TABLE public.payment_interest_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation select" ON public.payment_interest_config
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT t.id FROM tenants t INNER JOIN user_roles ur ON ur.user_id = auth.uid() WHERE t.id = payment_interest_config.tenant_id));

CREATE POLICY "Tenant isolation insert" ON public.payment_interest_config
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT t.id FROM tenants t INNER JOIN user_roles ur ON ur.user_id = auth.uid() WHERE t.id = payment_interest_config.tenant_id));

CREATE POLICY "Tenant isolation update" ON public.payment_interest_config
  FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT t.id FROM tenants t INNER JOIN user_roles ur ON ur.user_id = auth.uid() WHERE t.id = payment_interest_config.tenant_id));

CREATE POLICY "Tenant isolation delete" ON public.payment_interest_config
  FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT t.id FROM tenants t INNER JOIN user_roles ur ON ur.user_id = auth.uid() WHERE t.id = payment_interest_config.tenant_id));

-- Trigger updated_at
CREATE TRIGGER update_payment_interest_config_updated_at
  BEFORE UPDATE ON public.payment_interest_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
