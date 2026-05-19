CREATE OR REPLACE FUNCTION public.handle_deal_commission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_vendedor_id UUID;
    v_percentual NUMERIC;
    v_valor_comissao NUMERIC;
    v_tenant_id UUID;
    v_cliente_id UUID;
    v_projeto_id UUID;
BEGIN
    -- GOVERNANÇA: Só gera comissão se houver EVIDÊNCIA de ganho (won_at)
    -- E se o status for 'ganho'
    IF NEW.status = 'won' 
       AND NEW.won_at IS NOT NULL 
       AND (OLD.won_at IS NULL OR OLD.status IS DISTINCT FROM 'won') THEN
       
        -- Check if commission already exists for this deal (idempotency)
        IF EXISTS (SELECT 1 FROM public.comissoes WHERE deal_id = NEW.id AND status <> 'cancelada') THEN
            RETURN NEW;
        END IF;

        v_vendedor_id := NEW.owner_id;
        v_tenant_id := NEW.tenant_id;
        v_cliente_id := NEW.customer_id;
        
        SELECT id INTO v_projeto_id FROM public.projetos WHERE lead_id = NEW.lead_id OR id = NEW.projeto_id LIMIT 1;

        -- Get commission percentage
        SELECT COALESCE(percentual_comissao, 2.0) INTO v_percentual 
        FROM public.profiles 
        WHERE user_id = v_vendedor_id;
        
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
            ano_referencia,
            created_at
        ) VALUES (
            v_tenant_id,
            v_vendedor_id,
            NEW.id,
            v_projeto_id,
            v_cliente_id,
            'Comissão automática: Deal #' || COALESCE(NEW.deal_num::text, NEW.id::text),
            NEW.value,
            v_percentual,
            v_valor_comissao,
            'pendente',
            date_trunc('month', NEW.won_at)::date,
            EXTRACT(MONTH FROM NEW.won_at)::int,
            EXTRACT(YEAR FROM NEW.won_at)::int,
            NEW.won_at
        );
    END IF;
    RETURN NEW;
END;
$function$;
