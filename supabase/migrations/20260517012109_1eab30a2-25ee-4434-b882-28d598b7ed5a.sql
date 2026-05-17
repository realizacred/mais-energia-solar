CREATE TABLE IF NOT EXISTS public.recibos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  projeto_id UUID NOT NULL REFERENCES public.projetos(id),
  cliente_id UUID REFERENCES public.clientes(id),
  template TEXT NOT NULL,
  numero TEXT,
  valor DECIMAL(12,2) NOT NULL,
  forma_pagamento TEXT NOT NULL,
  descricao TEXT,
  data_pagamento DATE NOT NULL,
  status TEXT DEFAULT 'emitido',
  pdf_url TEXT,
  campos_extras JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Enable RLS
ALTER TABLE public.recibos ENABLE ROW LEVEL SECURITY;

-- Index for performance
CREATE INDEX idx_recibos_projeto_id ON public.recibos(projeto_id);
CREATE INDEX idx_recibos_tenant_id ON public.recibos(tenant_id);

-- Policy for tenant isolation
CREATE POLICY "Users can view receipts from their own tenant"
ON public.recibos
FOR SELECT
USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert receipts into their own tenant"
ON public.recibos
FOR INSERT
WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update receipts from their own tenant"
ON public.recibos
FOR UPDATE
USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));
