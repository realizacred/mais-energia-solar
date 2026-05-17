-- 1. Add helpful columns for tracking approvals and payments
ALTER TABLE public.comissoes 
ADD COLUMN IF NOT EXISTS aprovada_por UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS aprovada_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS paga_por UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS paga_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT,
ADD COLUMN IF NOT EXISTS deal_id UUID REFERENCES public.deals(id),
ADD COLUMN IF NOT EXISTS competencia DATE;

-- 2. Create a function to handle deal status changes
CREATE OR REPLACE FUNCTION public.handle_deal_commission()
RETURNS TRIGGER AS $$
DECLARE
    v_vendedor_id UUID;
    v_percentual NUMERIC;
    v_valor_comissao NUMERIC;
    v_tenant_id UUID;
    v_cliente_id UUID;
    v_projeto_id UUID;
BEGIN
    -- Only trigger when status changes to 'ganho'
    IF NEW.status = 'ganho' AND (OLD.status IS NULL OR OLD.status != 'ganho') THEN
        -- Check if commission already exists for this deal (idempotency)
        IF EXISTS (SELECT 1 FROM public.comissoes WHERE deal_id = NEW.id) THEN
            RETURN NEW;
        END IF;

        -- Get consultant and their commission plan
        v_vendedor_id := NEW.owner_id;
        v_tenant_id := NEW.tenant_id;
        v_cliente_id := NEW.customer_id;
        
        -- Try to find associated projeto_id
        SELECT id INTO v_projeto_id FROM public.projetos WHERE lead_id = NEW.lead_id LIMIT 1;

        -- Get commission percentage from profiles
        SELECT percentual_comissao INTO v_percentual 
        FROM public.profiles 
        WHERE user_id = v_vendedor_id;
        
        IF v_percentual IS NULL THEN
            -- Check consultores table as fallback
            SELECT percentual_comissao INTO v_percentual 
            FROM public.consultores 
            WHERE id = v_vendedor_id OR user_id = v_vendedor_id
            LIMIT 1;
        END IF;

        -- Default to 2% if still null
        IF v_percentual IS NULL THEN
            v_percentual := 2.0;
        END IF;

        v_valor_comissao := (NEW.value * v_percentual) / 100;

        -- Insert into comissoes
        INSERT INTO public.comissoes (
            tenant_id,
            consultor_id,
            deal_id,
            projeto_id,
            cliente_id,
            descricao,
            valor_base,
            percentual_comissao,
            valor_comissao,
            status,
            competencia,
            mes_referencia,
            ano_referencia
        ) VALUES (
            v_tenant_id,
            v_vendedor_id,
            NEW.id,
            v_projeto_id,
            v_cliente_id,
            'Comissão automática: Deal #' || NEW.id,
            NEW.value,
            v_percentual,
            v_valor_comissao,
            'pendente',
            date_trunc('month', now())::date,
            EXTRACT(MONTH FROM now())::int,
            EXTRACT(YEAR FROM now())::int
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create trigger on deals
DROP TRIGGER IF EXISTS tr_deal_commission ON public.deals;
CREATE TRIGGER tr_deal_commission
AFTER UPDATE ON public.deals
FOR EACH ROW
EXECUTE FUNCTION public.handle_deal_commission();

-- 4. Ensure RLS is active and correct
ALTER TABLE public.comissoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Consultores podem ver suas próprias comissões" ON public.comissoes;
CREATE POLICY "Consultores podem ver suas próprias comissões"
ON public.comissoes
FOR SELECT
USING (auth.uid() = consultor_id);

DROP POLICY IF EXISTS "Gerentes podem ver todas as comissões do tenant" ON public.comissoes;
CREATE POLICY "Gerentes podem ver todas as comissões do tenant"
ON public.comissoes
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = auth.uid()
        AND tenant_id = comissoes.tenant_id
    )
);
