
CREATE TABLE IF NOT EXISTS public.lancamentos_financeiros (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  tipo text NOT NULL CHECK (tipo IN ('receita','despesa')),
  categoria text NOT NULL,
  descricao text NOT NULL,
  valor numeric(10,2) NOT NULL CHECK (valor > 0),
  data_lancamento date NOT NULL DEFAULT CURRENT_DATE,
  forma_pagamento text,
  status text NOT NULL DEFAULT 'confirmado'
    CHECK (status IN ('confirmado','pendente','cancelado')),
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  projeto_id uuid REFERENCES public.projetos(id) ON DELETE SET NULL,
  comprovante_url text,
  observacoes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.lancamentos_financeiros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.lancamentos_financeiros
  FOR ALL
  USING (tenant_id = public.current_tenant_id());

CREATE INDEX IF NOT EXISTS idx_lancamentos_financeiros_tenant
  ON public.lancamentos_financeiros(tenant_id);

CREATE INDEX IF NOT EXISTS idx_lancamentos_financeiros_data
  ON public.lancamentos_financeiros(tenant_id, data_lancamento);
