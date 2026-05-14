-- Adiciona sincronização automática de status do deal após aceite de proposta
CREATE OR REPLACE FUNCTION public.sync_deal_status_on_proposal_acceptance()
RETURNS TRIGGER AS $$
DECLARE
    v_deal_id uuid;
    v_pipeline_id uuid;
    v_won_stage_id uuid;
BEGIN
    -- Só age se o status mudar para um estado de aceite
    IF (LOWER(NEW.status) IN ('aceita', 'aceito', 'aprovada', 'ganha')) AND 
       (OLD.status IS NULL OR LOWER(OLD.status) NOT IN ('aceita', 'aceito', 'aprovada', 'ganha')) THEN
        
        v_deal_id := NEW.deal_id;
        IF v_deal_id IS NULL THEN
            v_deal_id := NEW.projeto_id;
        END IF;

        IF v_deal_id IS NOT NULL THEN
            -- 1. Atualiza status do deal para 'won'
            UPDATE public.deals SET status = 'won' WHERE id = v_deal_id;

            -- 2. Busca o funil comercial e sua etapa de ganho
            SELECT pipeline_id INTO v_pipeline_id FROM public.deals WHERE id = v_deal_id;
            
            IF v_pipeline_id IS NOT NULL THEN
                SELECT id INTO v_won_stage_id 
                FROM public.pipeline_stages 
                WHERE pipeline_id = v_pipeline_id AND is_won = true 
                LIMIT 1;

                IF v_won_stage_id IS NOT NULL THEN
                    -- Move o deal no funil comercial principal
                    UPDATE public.deal_pipeline_stages 
                    SET stage_id = v_won_stage_id 
                    WHERE deal_id = v_deal_id AND pipeline_id = v_pipeline_id;
                END IF;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cria o trigger se não existir
DROP TRIGGER IF EXISTS tr_sync_deal_status_on_proposal_acceptance ON public.propostas_nativas;
CREATE TRIGGER tr_sync_deal_status_on_proposal_acceptance
AFTER UPDATE ON public.propostas_nativas
FOR EACH ROW
EXECUTE FUNCTION public.sync_deal_status_on_proposal_acceptance();
