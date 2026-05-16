-- 1. Enhance credit_analysis_events
ALTER TABLE public.credit_analysis_events 
ADD COLUMN IF NOT EXISTS correlation_id UUID DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE INDEX IF NOT EXISTS idx_credit_events_correlation ON public.credit_analysis_events(correlation_id);
CREATE INDEX IF NOT EXISTS idx_credit_events_idempotency ON public.credit_analysis_events(tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 2. Create credit_operation_jobs for async orchestration
CREATE TABLE IF NOT EXISTS public.credit_operation_jobs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL,
    analysis_id UUID REFERENCES public.analise_credito(id),
    operation_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    payload JSONB DEFAULT '{}'::jsonb,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 5,
    last_error TEXT,
    idempotency_key TEXT,
    correlation_id UUID DEFAULT gen_random_uuid(),
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_jobs_idempotency 
ON public.credit_operation_jobs(tenant_id, idempotency_key) 
WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.credit_operation_jobs ENABLE ROW LEVEL SECURITY;

-- 3. Create credit_workflow_configs for configurable engine
CREATE TABLE IF NOT EXISTS public.credit_workflow_configs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL,
    bank_slug TEXT NOT NULL,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(tenant_id, bank_slug)
);

ALTER TABLE public.credit_workflow_configs ENABLE ROW LEVEL SECURITY;

-- 4. Create credit_operation_logs for observability
CREATE TABLE IF NOT EXISTS public.credit_operation_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL,
    level TEXT NOT NULL, 
    message TEXT NOT NULL,
    context JSONB DEFAULT '{}'::jsonb,
    correlation_id UUID,
    actor_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.credit_operation_logs ENABLE ROW LEVEL SECURITY;

-- 5. Protection trigger for documents
CREATE OR REPLACE FUNCTION public.check_credit_analysis_locked()
RETURNS TRIGGER AS $$
DECLARE
    is_locked_status BOOLEAN;
BEGIN
    SELECT is_locked INTO is_locked_status 
    FROM public.analise_credito 
    WHERE id = OLD.analise_credito_id;

    IF is_locked_status = true THEN
        RAISE EXCEPTION 'Não é possível remover documentos de uma análise de crédito bloqueada ou finalizada.';
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_protect_locked_docs ON public.analise_credito_documentos;
CREATE TRIGGER tr_protect_locked_docs
BEFORE DELETE ON public.analise_credito_documentos
FOR EACH ROW
EXECUTE FUNCTION public.check_credit_analysis_locked();

-- 6. RLS Policies
-- Events (Append-only)
DROP POLICY IF EXISTS "Standard Insert Events" ON public.credit_analysis_events;
CREATE POLICY "Standard Insert Events" 
ON public.credit_analysis_events 
FOR INSERT 
WITH CHECK (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS "Standard Select Events" ON public.credit_analysis_events;
CREATE POLICY "Standard Select Events" 
ON public.credit_analysis_events 
FOR SELECT 
USING (tenant_id = get_current_tenant_id());

-- Jobs
CREATE POLICY "Standard Select Jobs" 
ON public.credit_operation_jobs 
FOR SELECT 
USING (tenant_id = get_current_tenant_id());

CREATE POLICY "Standard Insert Jobs" 
ON public.credit_operation_jobs 
FOR INSERT 
WITH CHECK (tenant_id = get_current_tenant_id());

-- Workflow Configs
CREATE POLICY "Standard Manage Configs" 
ON public.credit_workflow_configs 
FOR ALL 
USING (tenant_id = get_current_tenant_id());

-- Logs
CREATE POLICY "Standard Select Logs" 
ON public.credit_operation_logs 
FOR SELECT 
USING (tenant_id = get_current_tenant_id());

-- 7. Automated timestamps 
DROP TRIGGER IF EXISTS update_credit_jobs_updated_at ON public.credit_operation_jobs;
CREATE TRIGGER update_credit_jobs_updated_at
BEFORE UPDATE ON public.credit_operation_jobs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_credit_workflow_updated_at ON public.credit_workflow_configs;
CREATE TRIGGER update_credit_workflow_updated_at
BEFORE UPDATE ON public.credit_workflow_configs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
