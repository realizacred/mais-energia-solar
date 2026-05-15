-- Criar tipo de status de cheque
DO $$ BEGIN
    CREATE TYPE cheque_status AS ENUM (
        'recebido',
        'em_carteira',
        'depositado',
        'compensado',
        'devolvido',
        'repassado',
        'cancelado'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tabela de Cheques
CREATE TABLE IF NOT EXISTS public.cheques (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    cliente_id UUID NOT NULL REFERENCES public.clientes(id),
    projeto_id UUID REFERENCES public.projetos(id),
    recebimento_id UUID REFERENCES public.recebimentos(id),
    parcela_id UUID REFERENCES public.parcelas(id),
    pagamento_id UUID REFERENCES public.pagamentos(id),
    
    numero_cheque TEXT NOT NULL,
    banco TEXT NOT NULL,
    agencia TEXT,
    conta TEXT,
    titular TEXT NOT NULL,
    cpf_cnpj_titular TEXT,
    
    valor NUMERIC(15,2) NOT NULL DEFAULT 0,
    data_emissao DATE NOT NULL DEFAULT CURRENT_DATE,
    data_vencimento DATE NOT NULL,
    data_compensacao DATE,
    
    origem TEXT, -- Ex: "Venda Direta", "Entrada Projeto X"
    destino TEXT, -- Ex: "Banco Itaú", "Fornecedor Y"
    recebido_de TEXT, -- Nome da pessoa que entregou
    entregue_para TEXT, -- Nome de quem recebeu o repasse
    
    status cheque_status NOT NULL DEFAULT 'recebido',
    observacoes TEXT,
    comprovante_url TEXT,
    
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Habilitar RLS
ALTER TABLE public.cheques ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view their own tenant cheques"
    ON public.cheques FOR SELECT
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their own tenant cheques"
    ON public.cheques FOR INSERT
    WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their own tenant cheques"
    ON public.cheques FOR UPDATE
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

-- Tabela de Movimentações de Cheques (Audit Trail)
CREATE TABLE IF NOT EXISTS public.cheque_movimentacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    cheque_id UUID NOT NULL REFERENCES public.cheques(id) ON DELETE CASCADE,
    
    from_status cheque_status,
    to_status cheque_status NOT NULL,
    tipo_movimento TEXT NOT NULL, -- Ex: "deposito", "baixa", "repasse", "devolucao"
    
    destino_tipo TEXT, -- Ex: "conta_bancaria", "fornecedor", "cliente"
    destino_id UUID,   -- Referência futura para conta_bancaria_id ou fornecedor_id
    
    descricao TEXT,
    actor_id UUID REFERENCES auth.users(id),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS Movimentações
ALTER TABLE public.cheque_movimentacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tenant cheque movements"
    ON public.cheque_movimentacoes FOR SELECT
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their own tenant cheque movements"
    ON public.cheque_movimentacoes FOR INSERT
    WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_cheques_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER tr_cheques_updated_at
    BEFORE UPDATE ON public.cheques
    FOR EACH ROW
    EXECUTE FUNCTION update_cheques_updated_at();

-- Adicionar configurações financeiras para cheques se não existirem
ALTER TABLE public.financial_settings 
ADD COLUMN IF NOT EXISTS cheque_control_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS cheque_allow_transfer BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS cheque_require_attachment_on_deposit BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS cheque_require_reason_on_return BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS cheque_treat_as_paid_on_receive BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS cheque_alert_days_before_due INTEGER DEFAULT 3;

-- Função para registrar movimentação automática ao atualizar status
CREATE OR REPLACE FUNCTION public.fn_cheque_log_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO public.cheque_movimentacoes (
            tenant_id,
            cheque_id,
            from_status,
            to_status,
            tipo_movimento,
            actor_id,
            descricao
        ) VALUES (
            NEW.tenant_id,
            NEW.id,
            OLD.status,
            NEW.status,
            'status_change',
            auth.uid(),
            'Alteração automática de status'
        );
        
        -- Também registrar no log de auditoria financeira global
        INSERT INTO public.financial_audit_logs (
            tenant_id,
            actor_id,
            entity_type,
            entity_id,
            action,
            before_data,
            after_data,
            reason
        ) VALUES (
            NEW.tenant_id,
            auth.uid(),
            'cheque',
            NEW.id,
            'status_update',
            jsonb_build_object('status', OLD.status),
            jsonb_build_object('status', NEW.status),
            'Alteração de status do cheque'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_cheque_status_change
    AFTER UPDATE ON public.cheques
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_cheque_log_status_change();
