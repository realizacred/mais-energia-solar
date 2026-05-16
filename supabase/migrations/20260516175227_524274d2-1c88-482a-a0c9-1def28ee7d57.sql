-- Add more statuses to analise_credito if needed (the hook already assumes some)
-- We'll use a check constraint for the status to allow the requested lifecycle
DO $$ 
BEGIN 
    ALTER TABLE public.analise_credito DROP CONSTRAINT IF EXISTS analise_credito_status_check;
    ALTER TABLE public.analise_credito ADD CONSTRAINT analise_credito_status_check 
    CHECK (status IN ('rascunho', 'pendente_documentos', 'pronto_para_envio', 'enviada_ao_banco', 'em_analise', 'aprovado', 'aprovado_com_condicoes', 'reprovado', 'cancelado'));
EXCEPTION
    WHEN undefined_column THEN
        -- Table might not have status yet or is being created
        NULL;
END $$;

-- Table for credit analysis history (Audit Trail)
CREATE TABLE IF NOT EXISTS public.analise_credito_historico (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    analise_credito_id UUID NOT NULL REFERENCES public.analise_credito(id) ON DELETE CASCADE,
    status_anterior TEXT,
    status_novo TEXT NOT NULL,
    actor_id UUID REFERENCES auth.users(id),
    observacoes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table to link project_documents to credit analysis (SSOT)
CREATE TABLE IF NOT EXISTS public.analise_credito_documentos (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    analise_credito_id UUID NOT NULL REFERENCES public.analise_credito(id) ON DELETE CASCADE,
    project_document_id UUID NOT NULL REFERENCES public.project_documents(id) ON DELETE CASCADE,
    checklist_item_id UUID REFERENCES public.credit_bank_checklists(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(analise_credito_id, project_document_id)
);

-- Enable RLS
ALTER TABLE public.analise_credito_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analise_credito_documentos ENABLE ROW LEVEL SECURITY;

-- Policies for history
CREATE POLICY "Users can view history of their tenant" 
ON public.analise_credito_historico FOR SELECT 
USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert history for their tenant" 
ON public.analise_credito_historico FOR INSERT 
WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

-- Policies for document links
CREATE POLICY "Users can view credit docs of their tenant" 
ON public.analise_credito_documentos FOR SELECT 
USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage credit docs of their tenant" 
ON public.analise_credito_documentos FOR ALL 
USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

-- Add trigger function for automatic status history if not exists
CREATE OR REPLACE FUNCTION public.fn_log_analise_credito_status()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') OR (OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO public.analise_credito_historico (
            tenant_id,
            analise_credito_id,
            status_anterior,
            status_novo,
            actor_id,
            observacoes
        ) VALUES (
            NEW.tenant_id,
            NEW.id,
            CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
            NEW.status,
            auth.uid(),
            'Alteração automática de status'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS tr_log_analise_credito_status ON public.analise_credito;
CREATE TRIGGER tr_log_analise_credito_status
AFTER INSERT OR UPDATE OF status ON public.analise_credito
FOR EACH ROW EXECUTE FUNCTION public.fn_log_analise_credito_status();
