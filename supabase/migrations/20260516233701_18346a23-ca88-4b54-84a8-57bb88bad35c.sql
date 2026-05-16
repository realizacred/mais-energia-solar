-- Tabela de configuração de integrações financeiras
CREATE TABLE public.financeiras_config (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL, -- Removido FK para evitar erro de restrição única em profiles
    financeira TEXT NOT NULL DEFAULT 'eos',
    client_id TEXT NOT NULL,
    client_secret TEXT NOT NULL,
    ambiente TEXT NOT NULL DEFAULT 'sandbox' CHECK (ambiente IN ('sandbox', 'producao')),
    ativo BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, financeira)
);

-- Habilitar RLS
ALTER TABLE public.financeiras_config ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Admins can manage financial configs"
ON public.financeiras_config
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'super_admin')
    )
);

CREATE POLICY "Users can view their tenant configs"
ON public.financeiras_config
FOR SELECT
USING (
    tenant_id IN (
        SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()
    )
);

-- Trigger para updated_at
CREATE TRIGGER update_financeiras_config_updated_at
BEFORE UPDATE ON public.financeiras_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar colunas necessárias na tabela analise_credito para integração EOS
ALTER TABLE public.analise_credito 
ADD COLUMN IF NOT EXISTS eos_proposta_id TEXT,
ADD COLUMN IF NOT EXISTS eos_enviado_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS simulacao_resultado JSONB,
ADD COLUMN IF NOT EXISTS simulacao_at TIMESTAMP WITH TIME ZONE;