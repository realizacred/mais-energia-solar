-- Adicionar percentual_comissao se não existir
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS percentual_comissao DECIMAL(5,2) DEFAULT 0;

ALTER TABLE public.consultores
ADD COLUMN IF NOT EXISTS percentual_comissao DECIMAL(5,2) DEFAULT 0;

-- Criar tabela de histórico de consultor se não existir
CREATE TABLE IF NOT EXISTS public.consultor_historico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES public.leads(id),
    consultor_id UUID REFERENCES auth.users(id),
    acao TEXT NOT NULL, -- 'assumiu_lead', 'transferiu_lead', etc
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    tenant_id UUID NOT NULL
);

-- Ativar RLS
ALTER TABLE public.consultor_historico ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "consultores_leitura_historico" ON public.consultor_historico
FOR SELECT USING (auth.uid() = consultor_id OR (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'gerente'))));

CREATE POLICY "consultores_insere_historico" ON public.consultor_historico
FOR INSERT WITH CHECK (auth.uid() = consultor_id);