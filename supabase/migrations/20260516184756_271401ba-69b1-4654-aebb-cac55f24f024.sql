-- 1. Add hardening columns to analise_credito
ALTER TABLE public.analise_credito 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS checklist_snapshot JSONB,
ADD COLUMN IF NOT EXISTS rules_snapshot JSONB,
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;

-- 2. Create function to validate status transitions
CREATE OR REPLACE FUNCTION public.validate_credit_status_transition()
RETURNS TRIGGER AS $$
DECLARE
    current_status TEXT;
    new_status TEXT;
BEGIN
    current_status := OLD.status;
    new_status := NEW.status;

    -- If status hasn't changed, just increment version if other fields changed
    IF current_status = new_status THEN
        IF OLD != NEW THEN
            NEW.version := OLD.version + 1;
        END IF;
        RETURN NEW;
    END IF;

    -- Prevent changes if already in final states
    IF current_status IN ('aprovada', 'reprovada', 'cancelada') AND auth.role() != 'service_role' THEN
        RAISE EXCEPTION 'Não é permitido alterar o status de uma análise finalizada (%)', current_status;
    END IF;

    -- Special lock: once sent to bank, restricted transitions
    IF current_status = 'enviada_ao_banco' AND new_status NOT IN ('em_analise', 'pendencia_bancaria', 'aprovada', 'reprovada', 'cancelada') THEN
        RAISE EXCEPTION 'Transição de status inválida após envio ao banco: % -> %', current_status, new_status;
    END IF;

    -- Lock the record if moving to final states
    IF new_status IN ('aprovada', 'reprovada', 'cancelada') THEN
        NEW.is_locked := TRUE;
    END IF;

    NEW.version := OLD.version + 1;
    NEW.updated_at := now();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 3. Create Trigger for status validation
DROP TRIGGER IF EXISTS tr_validate_credit_status ON public.analise_credito;
CREATE TRIGGER tr_validate_credit_status
BEFORE UPDATE ON public.analise_credito
FOR EACH ROW
EXECUTE FUNCTION public.validate_credit_status_transition();

-- 4. Function to snapshot requirements
CREATE OR REPLACE FUNCTION public.fn_snapshot_credit_requirements()
RETURNS TRIGGER AS $$
BEGIN
    -- Only snapshot if bank_config_id is set and (snapshot is empty OR bank changed)
    IF NEW.bank_config_id IS NOT NULL AND (NEW.checklist_snapshot IS NULL OR OLD.bank_config_id != NEW.bank_config_id) THEN
        SELECT jsonb_agg(sub) INTO NEW.checklist_snapshot
        FROM (
            SELECT document_type_name, is_required, applicable_to, description
            FROM public.credit_bank_checklists
            WHERE bank_config_id = NEW.bank_config_id
        ) sub;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 5. Create Trigger for requirement snapshot
DROP TRIGGER IF EXISTS tr_snapshot_credit_requirements ON public.analise_credito;
CREATE TRIGGER tr_snapshot_credit_requirements
BEFORE INSERT OR UPDATE OF bank_config_id, status ON public.analise_credito
FOR EACH ROW
WHEN (NEW.bank_config_id IS NOT NULL)
EXECUTE FUNCTION public.fn_snapshot_credit_requirements();

-- 6. Hard lock for documents
CREATE OR REPLACE FUNCTION public.fn_check_credit_doc_lock()
RETURNS TRIGGER AS $$
DECLARE
    v_status TEXT;
BEGIN
    SELECT status INTO v_status 
    FROM public.analise_credito 
    WHERE id = COALESCE(NEW.analise_credito_id, OLD.analise_credito_id);

    IF v_status IN ('enviada_ao_banco', 'aprovada', 'reprovada', 'cancelada') AND auth.role() != 'service_role' THEN
        RAISE EXCEPTION 'Não é permitido alterar documentos de uma análise com status %', v_status;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS tr_check_credit_doc_lock ON public.analise_credito_documentos;
CREATE TRIGGER tr_check_credit_doc_lock
BEFORE INSERT OR UPDATE OR DELETE ON public.analise_credito_documentos
FOR EACH ROW
EXECUTE FUNCTION public.fn_check_credit_doc_lock();

-- 7. Revised RLS Policies
ALTER TABLE public.analise_credito ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Consultants see their own analyses" ON public.analise_credito;
DROP POLICY IF EXISTS "Users can view credit analysis from their tenant" ON public.analise_credito;
DROP POLICY IF EXISTS "Credit Analysis Multi-tenant Isolation" ON public.analise_credito;

CREATE POLICY "Credit Analysis Multi-tenant Isolation" ON public.analise_credito
FOR SELECT USING (
    tenant_id = get_current_tenant_id()
    AND (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('admin', 'gerente', 'super_admin'))
        OR criado_por = auth.uid()
        OR deal_id IN (SELECT id FROM deals WHERE owner_id = auth.uid())
    )
);

CREATE POLICY "Credit Analysis Multi-tenant Insert" ON public.analise_credito
FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY "Credit Analysis Multi-tenant Update" ON public.analise_credito
FOR UPDATE USING (
    tenant_id = get_current_tenant_id()
    AND (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('admin', 'gerente', 'super_admin'))
        OR criado_por = auth.uid()
    )
);
