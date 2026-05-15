-- Tabela de configurações financeiras por tenant
CREATE TABLE IF NOT EXISTS public.financial_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    -- Configurações de Recibos
    receipt_auto_emit BOOLEAN DEFAULT true,
    receipt_allow_standalone BOOLEAN DEFAULT true,
    receipt_auto_numbering BOOLEAN DEFAULT true,
    receipt_show_qrcode BOOLEAN DEFAULT true,
    receipt_digital_signature BOOLEAN DEFAULT false,
    
    -- Configurações de Caixa
    cash_strict_opening BOOLEAN DEFAULT false,
    cash_daily_closing BOOLEAN DEFAULT false,
    cash_multi_user BOOLEAN DEFAULT false,
    cash_lock_on_close BOOLEAN DEFAULT true,
    
    -- Configurações de Comissões
    commission_trigger TEXT DEFAULT 'payment_cleared' CHECK (commission_trigger IN ('proposal_accepted', 'payment_cleared', 'manual')),
    
    -- Configurações de Auditoria/Segurança
    audit_require_justification BOOLEAN DEFAULT false,
    audit_allow_hard_delete BOOLEAN DEFAULT false,
    audit_storno_approval_required BOOLEAN DEFAULT false,
    audit_lock_days INTEGER DEFAULT 0,
    
    -- Automação
    automation_whatsapp_enabled BOOLEAN DEFAULT false,
    automation_email_enabled BOOLEAN DEFAULT false,
    
    -- Feature Flags / Versionamento Interno
    feature_flags JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    CONSTRAINT unique_tenant_financial_settings UNIQUE (tenant_id)
);

-- Enable RLS
ALTER TABLE public.financial_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Tenants can view their own financial settings"
    ON public.financial_settings FOR SELECT
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Tenants can update their own financial settings"
    ON public.financial_settings FOR UPDATE
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.handle_financial_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_financial_settings_updated_at
    BEFORE UPDATE ON public.financial_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_financial_settings_updated_at();

-- Comentários para documentação
COMMENT ON TABLE public.financial_settings IS 'Armazena regras operacionais financeiras configuráveis por tenant (SaaS).';
COMMENT ON COLUMN public.financial_settings.commission_trigger IS 'Gatilho para geração de comissão: proposal_accepted ou payment_cleared.';
