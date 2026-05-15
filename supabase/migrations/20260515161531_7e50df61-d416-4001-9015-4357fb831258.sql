-- 1. Add columns to analise_credito
ALTER TABLE public.analise_credito 
ADD COLUMN IF NOT EXISTS tipo_pessoa TEXT,
ADD COLUMN IF NOT EXISTS entrada NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS protocolo_banco TEXT,
ADD COLUMN IF NOT EXISTS data_envio TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS data_retorno TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS responsavel_id UUID REFERENCES auth.users(id);

-- 2. Create credit_bank_configs
CREATE TABLE public.credit_bank_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    bank_name TEXT NOT NULL,
    slug TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    icon_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for credit_bank_configs
ALTER TABLE public.credit_bank_configs ENABLE ROW LEVEL SECURITY;

-- 3. Create credit_bank_checklists
CREATE TABLE public.credit_bank_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    bank_config_id UUID NOT NULL REFERENCES public.credit_bank_configs(id) ON DELETE CASCADE,
    document_type_name TEXT NOT NULL,
    is_required BOOLEAN DEFAULT TRUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for credit_bank_checklists
ALTER TABLE public.credit_bank_checklists ENABLE ROW LEVEL SECURITY;

-- 4. Create analise_credito_historico
CREATE TABLE public.analise_credito_historico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    analise_id UUID NOT NULL REFERENCES public.analise_credito(id) ON DELETE CASCADE,
    status_anterior TEXT,
    novo_status TEXT NOT NULL,
    motivo TEXT,
    usuario_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for analise_credito_historico
ALTER TABLE public.analise_credito_historico ENABLE ROW LEVEL SECURITY;

-- 5. Create analise_credito_documentos
CREATE TABLE public.analise_credito_documentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    analise_id UUID NOT NULL REFERENCES public.analise_credito(id) ON DELETE CASCADE,
    file_id UUID NOT NULL REFERENCES public.entity_files(id) ON DELETE CASCADE,
    status_verificacao TEXT DEFAULT 'pendente',
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for analise_credito_documentos
ALTER TABLE public.analise_credito_documentos ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies (Patterned after analise_credito)

-- Function to get current tenant_id safely
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- credit_bank_configs policies
CREATE POLICY "Users can view bank configs from their tenant" 
ON public.credit_bank_configs FOR SELECT 
USING (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can insert bank configs into their tenant" 
ON public.credit_bank_configs FOR INSERT 
WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can update bank configs from their tenant" 
ON public.credit_bank_configs FOR UPDATE 
USING (tenant_id = public.get_current_tenant_id());

-- credit_bank_checklists policies
CREATE POLICY "Users can view checklists from their tenant" 
ON public.credit_bank_checklists FOR SELECT 
USING (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can insert checklists into their tenant" 
ON public.credit_bank_checklists FOR INSERT 
WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can update checklists from their tenant" 
ON public.credit_bank_checklists FOR UPDATE 
USING (tenant_id = public.get_current_tenant_id());

-- analise_credito_historico policies
CREATE POLICY "Users can view history from their tenant" 
ON public.analise_credito_historico FOR SELECT 
USING (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can insert history into their tenant" 
ON public.analise_credito_historico FOR INSERT 
WITH CHECK (tenant_id = public.get_current_tenant_id());

-- analise_credito_documentos policies
CREATE POLICY "Users can view documents from their tenant" 
ON public.analise_credito_documentos FOR SELECT 
USING (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can insert documents into their tenant" 
ON public.analise_credito_documentos FOR INSERT 
WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can update documents from their tenant" 
ON public.analise_credito_documentos FOR UPDATE 
USING (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can delete documents from their tenant" 
ON public.analise_credito_documentos FOR DELETE 
USING (tenant_id = public.get_current_tenant_id());

-- 7. Trigger for status history
CREATE OR REPLACE FUNCTION public.fn_log_analise_credito_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') OR (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.analise_credito_historico (
      tenant_id,
      analise_id,
      status_anterior,
      novo_status,
      usuario_id
    ) VALUES (
      NEW.tenant_id,
      NEW.id,
      CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.status END,
      NEW.status,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_analise_credito_status_history
AFTER INSERT OR UPDATE OF status ON public.analise_credito
FOR EACH ROW
EXECUTE FUNCTION public.fn_log_analise_credito_status_change();

-- 8. Seed initial data (for the main tenant mentioned in AGENTS.md if possible, or generic)
-- We will use a subquery to find active tenants if needed, but let's just insert for a few known banks.

DO $$
DECLARE
    v_tenant_id UUID;
    v_bank_id UUID;
BEGIN
    -- Get the primary tenant from AGENTS.md or the first one found
    v_tenant_id := '17de8315-2e2f-4a79-8751-e5d507d69a41'; -- Default from AGENTS.md
    
    -- Ensure tenant exists before seeding
    IF EXISTS (SELECT 1 FROM public.profiles WHERE tenant_id = v_tenant_id) THEN
        
        -- Santander
        INSERT INTO public.credit_bank_configs (tenant_id, bank_name, slug)
        VALUES (v_tenant_id, 'Santander', 'santander')
        RETURNING id INTO v_bank_id;
        
        INSERT INTO public.credit_bank_checklists (tenant_id, bank_config_id, document_type_name)
        VALUES 
        (v_tenant_id, v_bank_id, 'RG/CNH'),
        (v_tenant_id, v_bank_id, 'Comprovante de Residência'),
        (v_tenant_id, v_bank_id, 'Comprovante de Renda (3 meses)');
        
        -- BV
        INSERT INTO public.credit_bank_configs (tenant_id, bank_name, slug)
        VALUES (v_tenant_id, 'BV Financeira', 'bv')
        RETURNING id INTO v_bank_id;
        
        INSERT INTO public.credit_bank_checklists (tenant_id, bank_config_id, document_type_name)
        VALUES 
        (v_tenant_id, v_bank_id, 'RG/CNH'),
        (v_tenant_id, v_bank_id, 'Comprovante de Residência');
        
        -- Solfácil
        INSERT INTO public.credit_bank_configs (tenant_id, bank_name, slug)
        VALUES (v_tenant_id, 'Solfácil', 'solfacil')
        RETURNING id INTO v_bank_id;
        
        INSERT INTO public.credit_bank_checklists (tenant_id, bank_config_id, document_type_name)
        VALUES 
        (v_tenant_id, v_bank_id, 'RG/CNH'),
        (v_tenant_id, v_bank_id, 'Selfie com documento');
        
    END IF;
END $$;
