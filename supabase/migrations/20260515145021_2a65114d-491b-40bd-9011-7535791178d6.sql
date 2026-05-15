-- 1. Tabela append-only para logs de auditoria financeira
CREATE TABLE public.financial_audit_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    actor_id UUID REFERENCES auth.users(id),
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    action TEXT NOT NULL,
    reason TEXT,
    before_data JSONB,
    after_data JSONB,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.financial_audit_logs ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para financial_audit_logs
CREATE POLICY "Admins can view their own tenant audit logs"
ON public.financial_audit_logs
FOR SELECT
USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid())
    AND EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role::text IN ('admin', 'gerente', 'financeiro')
    )
);

CREATE POLICY "System/Users can insert audit logs"
ON public.financial_audit_logs
FOR INSERT
WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

-- 2. Função de validação de mutação financeira (Backend Guard)
CREATE OR REPLACE FUNCTION public.validate_financial_mutation()
RETURNS TRIGGER AS $$
DECLARE
    settings_rec RECORD;
    is_closed BOOLEAN;
    payment_date DATE;
    v_tenant_id UUID;
    v_actor_id UUID;
BEGIN
    v_actor_id := auth.uid();

    -- Determinar o tenant_id e data
    IF (TG_OP = 'DELETE') THEN
        v_tenant_id := OLD.tenant_id;
        payment_date := COALESCE(OLD.data_pagamento, OLD.created_at::date);
    ELSE
        v_tenant_id := NEW.tenant_id;
        payment_date := COALESCE(NEW.data_pagamento, NEW.created_at::date);
    END IF;

    -- Carregar configurações financeiras
    SELECT * INTO settings_rec FROM public.financial_settings WHERE tenant_id = v_tenant_id;
    
    -- Se não houver configurações, assume o padrão seguro (travado)
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Configurações financeiras não encontradas para este tenant.';
    END IF;

    -- 1. Bloquear DELETE se audit_allow_hard_delete for false
    IF (TG_OP = 'DELETE' AND settings_rec.audit_allow_hard_delete = false) THEN
        INSERT INTO public.financial_audit_logs (tenant_id, actor_id, entity_type, entity_id, action, reason, metadata)
        VALUES (v_tenant_id, v_actor_id, 'pagamento', OLD.id, 'delete_attempt_blocked', 'Exclusão física não permitida por política de segurança', jsonb_build_object('op', 'DELETE'));
        RAISE EXCEPTION 'A exclusão física de pagamentos está desativada para sua empresa. Use o estorno.';
    END IF;

    -- 2. Bloquear UPDATE/DELETE se fora da janela audit_lock_days
    IF (settings_rec.audit_lock_days > 0 AND (CURRENT_DATE - payment_date) > settings_rec.audit_lock_days) THEN
        INSERT INTO public.financial_audit_logs (tenant_id, actor_id, entity_type, entity_id, action, reason, metadata)
        VALUES (v_tenant_id, v_actor_id, 'pagamento', (CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END), TG_OP || '_attempt_blocked', 'Fora da janela de edição de ' || settings_rec.audit_lock_days || ' dias', jsonb_build_object('op', TG_OP, 'payment_date', payment_date));
        RAISE EXCEPTION 'Este pagamento não pode mais ser alterado/excluído pois ultrapassou a janela de % dias.', settings_rec.audit_lock_days;
    END IF;

    -- 3. Bloquear se o período estiver fechado em fechamentos_caixa
    SELECT EXISTS (
        SELECT 1 FROM public.fechamentos_caixa 
        WHERE tenant_id = v_tenant_id 
        AND status = 'fechado' 
        AND data_inicio <= payment_date 
        AND data_fim >= payment_date
    ) INTO is_closed;

    IF (is_closed) THEN
        INSERT INTO public.financial_audit_logs (tenant_id, actor_id, entity_type, entity_id, action, reason, metadata)
        VALUES (v_tenant_id, v_actor_id, 'pagamento', (CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END), TG_OP || '_attempt_blocked', 'Período financeiro fechado', jsonb_build_object('op', TG_OP, 'payment_date', payment_date));
        RAISE EXCEPTION 'Este período financeiro já foi fechado e não permite alterações.';
    END IF;

    -- 4. Registro de sucesso no log
    IF (TG_OP = 'DELETE') THEN
        INSERT INTO public.financial_audit_logs (tenant_id, actor_id, entity_type, entity_id, action, before_data)
        VALUES (v_tenant_id, v_actor_id, 'pagamento', OLD.id, 'deleted', row_to_json(OLD)::jsonb);
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO public.financial_audit_logs (tenant_id, actor_id, entity_type, entity_id, action, before_data, after_data)
        VALUES (v_tenant_id, v_actor_id, 'pagamento', NEW.id, 'updated', row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
    ELSIF (TG_OP = 'INSERT') THEN
         INSERT INTO public.financial_audit_logs (tenant_id, actor_id, entity_type, entity_id, action, after_data)
         VALUES (v_tenant_id, v_actor_id, 'pagamento', NEW.id, 'created', row_to_json(NEW)::jsonb);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger na tabela pagamentos
DROP TRIGGER IF EXISTS trigger_validate_pagamento_mutation ON public.pagamentos;
CREATE TRIGGER trigger_validate_pagamento_mutation
BEFORE INSERT OR UPDATE OR DELETE ON public.pagamentos
FOR EACH ROW EXECUTE FUNCTION public.validate_financial_mutation();

-- 4. Log para alteração de configurações financeiras
CREATE OR REPLACE FUNCTION public.log_settings_change()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.financial_audit_logs (tenant_id, actor_id, entity_type, entity_id, action, before_data, after_data)
    VALUES (NEW.tenant_id, auth.uid(), 'financial_settings', NEW.id, 'settings_updated', row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_financial_settings_update ON public.financial_settings;
CREATE TRIGGER trigger_log_financial_settings_update
AFTER UPDATE ON public.financial_settings
FOR EACH ROW EXECUTE FUNCTION public.log_settings_change();
