-- Add operational fields to projects
ALTER TABLE public.projetos 
ADD COLUMN IF NOT EXISTS proxima_acao TEXT,
ADD COLUMN IF NOT EXISTS responsavel_operacional TEXT, -- Engenharia, Financeiro, Instalação, Administrativo, Concessionária
ADD COLUMN IF NOT EXISTS prazo_acao TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS dependencia_tipo TEXT, -- aguardando cliente, aguardando equipe interna, aguardando concessionária, aguardando financeiro
ADD COLUMN IF NOT EXISTS ultima_mudanca_operacional_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create operational events table for timeline
CREATE TABLE IF NOT EXISTS public.projeto_operacoes_eventos (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    projeto_id UUID REFERENCES public.projetos(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL, -- 'status_change', 'responsible_change', 'action_completed', 'dependency_change', 'next_action_update'
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.projeto_operacoes_eventos ENABLE ROW LEVEL SECURITY;

-- Policies for projeto_operacoes_eventos
CREATE POLICY "Users can view project events for their tenant" 
ON public.projeto_operacoes_eventos 
FOR SELECT 
USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert project events for their tenant" 
ON public.projeto_operacoes_eventos 
FOR INSERT 
WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_projeto_operacoes_eventos_projeto_id ON public.projeto_operacoes_eventos(projeto_id);
