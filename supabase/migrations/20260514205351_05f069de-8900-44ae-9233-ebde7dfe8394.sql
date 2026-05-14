-- Criar tabela de análise de crédito
CREATE TABLE public.analise_credito (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
    deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_analise', 'aprovado', 'reprovado', 'cancelado')),
    cpf_cnpj TEXT,
    renda_mensal NUMERIC(15,2),
    score_credito INTEGER CHECK (score_credito >= 0 AND score_credito <= 1000),
    banco TEXT,
    valor_solicitado NUMERIC(15,2),
    valor_aprovado NUMERIC(15,2),
    prazo_meses INTEGER,
    taxa_juros NUMERIC(5,2),
    observacoes TEXT,
    criado_por UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.analise_credito ENABLE ROW LEVEL SECURITY;

-- Criar políticas de acesso por tenant
CREATE POLICY "Users can view credit analysis from their tenant" 
ON public.analise_credito 
FOR SELECT 
USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert credit analysis into their tenant" 
ON public.analise_credito 
FOR INSERT 
WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update credit analysis from their tenant" 
ON public.analise_credito 
FOR UPDATE 
USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete credit analysis from their tenant" 
ON public.analise_credito 
FOR DELETE 
USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_analise_credito_updated_at
BEFORE UPDATE ON public.analise_credito
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_analise_credito_tenant_id ON public.analise_credito(tenant_id);
CREATE INDEX idx_analise_credito_deal_id ON public.analise_credito(deal_id);
CREATE INDEX idx_analise_credito_cliente_id ON public.analise_credito(cliente_id);
CREATE INDEX idx_analise_credito_lead_id ON public.analise_credito(lead_id);
