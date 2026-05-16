-- Fase 2: Modelagem do Domínio Crédito (Corrigida sem proposals)

-- 1. Simulações (Comercial, rápido, sem obrigatoriedade)
CREATE TABLE IF NOT EXISTS public.credit_simulations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    projeto_id UUID REFERENCES public.deals(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    
    cliente_nome TEXT,
    cpf_cnpj TEXT,
    tipo_pessoa TEXT CHECK (tipo_pessoa IN ('pf', 'pj')),
    renda_mensal NUMERIC(15,2),
    
    valor_solicitado NUMERIC(15,2),
    valor_entrada NUMERIC(15,2) DEFAULT 0,
    prazo_meses INTEGER,
    taxa_juros_estimada NUMERIC(5,2),
    
    banco_id UUID REFERENCES public.credit_bank_configs(id),
    status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'simulada', 'descartada', 'convertida_em_analise')),
    
    snapshot_proposta JSONB,
    observacoes TEXT,
    
    criado_por UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Análises Reais (Operação real, exige banco e documentos)
ALTER TABLE public.analise_credito 
ADD COLUMN IF NOT EXISTS simulation_id UUID REFERENCES public.credit_simulations(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS snapshot_data JSONB,
ADD COLUMN IF NOT EXISTS sla_vencimento TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS status_detalhado TEXT;

-- 3. Eventos / Timeline (Auditoria profunda)
CREATE TABLE IF NOT EXISTS public.credit_analysis_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    analise_id UUID REFERENCES public.analise_credito(id) ON DELETE CASCADE,
    simulation_id UUID REFERENCES public.credit_simulations(id) ON DELETE CASCADE,
    projeto_id UUID REFERENCES public.deals(id) ON DELETE CASCADE,
    
    event_type TEXT NOT NULL, 
    actor_id UUID REFERENCES auth.users(id),
    
    status_anterior TEXT,
    status_novo TEXT,
    
    payload JSONB, 
    observacoes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. RLS e Segurança
ALTER TABLE public.credit_simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_analysis_events ENABLE ROW LEVEL SECURITY;

-- Políticas para Simulações
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'credit_simulations' AND policyname = 'Users can view their tenant simulations') THEN
        CREATE POLICY "Users can view their tenant simulations" 
        ON public.credit_simulations FOR SELECT 
        USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'credit_simulations' AND policyname = 'Users can insert simulations in their tenant') THEN
        CREATE POLICY "Users can insert simulations in their tenant" 
        ON public.credit_simulations FOR INSERT 
        WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'credit_simulations' AND policyname = 'Users can update their tenant simulations') THEN
        CREATE POLICY "Users can update their tenant simulations" 
        ON public.credit_simulations FOR UPDATE 
        USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));
    END IF;
END $$;

-- Políticas para Eventos
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'credit_analysis_events' AND policyname = 'Users can view their tenant credit events') THEN
        CREATE POLICY "Users can view their tenant credit events" 
        ON public.credit_analysis_events FOR SELECT 
        USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'credit_analysis_events' AND policyname = 'System can insert credit events') THEN
        CREATE POLICY "System can insert credit events" 
        ON public.credit_analysis_events FOR INSERT 
        WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));
    END IF;
END $$;

-- 5. Trigger
CREATE OR REPLACE FUNCTION public.fn_credit_simulation_updated()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_credit_simulation_updated ON public.credit_simulations;
CREATE TRIGGER tr_credit_simulation_updated
BEFORE UPDATE ON public.credit_simulations
FOR EACH ROW EXECUTE FUNCTION public.fn_credit_simulation_updated();
