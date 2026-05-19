CREATE OR REPLACE FUNCTION public.sync_deal_status_on_proposal_acceptance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_deal_id uuid;
    v_pipeline_id uuid;
    v_won_stage_id uuid;
    v_current_status text;
    v_has_formal_event boolean;
BEGIN
    -- 1. REGRA DE OURO: SÓ age se for a PROPOSTA PRINCIPAL
    IF NOT COALESCE(NEW.is_principal, false) THEN
        RETURN NEW;
    END IF;

    -- 2. BLOQUEIO DE NORMALIZAÇÃO/BACKFILL:
    -- Só prossegue se o status mudou para 'accepted' E existe timestamp de aceite formal
    IF (LOWER(NEW.status) IN ('accepted', 'aceita')) AND 
       (OLD.status IS DISTINCT FROM NEW.status) AND
       (NEW.aceita_at IS NOT NULL) THEN
        
        -- 3. EVIDÊNCIA ADICIONAL (Governance Check):
        -- Verifica se existe um evento formal de aceite registrado para esta proposta
        -- Isso blinda contra updates manuais diretos na tabela via scripts que setam aceita_at de forma arbitrária
        SELECT EXISTS (
            SELECT 1 FROM public.proposal_events 
            WHERE proposta_id = NEW.id 
              AND (tipo = 'proposta_aceita' OR (tipo = 'status_change' AND payload->>'new_status' IN ('aceita', 'accepted')))
        ) INTO v_has_formal_event;

        -- Se não houver evento formal, aborta promoção (Padrão Enterprise: No Event, No Win)
        IF NOT v_has_formal_event THEN
            -- Opcional: Registrar alerta de inconsistência interna poderia ser feito aqui via log
            RETURN NEW;
        END IF;

        v_deal_id := COALESCE(NEW.deal_id, NEW.projeto_id);

        IF v_deal_id IS NOT NULL THEN
            SELECT status INTO v_current_status FROM public.deals WHERE id = v_deal_id;
            
            -- Só promove se ainda não estiver ganho
            IF v_current_status IS DISTINCT FROM 'won' THEN
                UPDATE public.deals SET status = 'won', updated_at = now() WHERE id = v_deal_id;

                SELECT pipeline_id INTO v_pipeline_id FROM public.deals WHERE id = v_deal_id;
                
                IF v_pipeline_id IS NOT NULL THEN
                    SELECT id INTO v_won_stage_id 
                    FROM public.pipeline_stages 
                    WHERE pipeline_id = v_pipeline_id AND is_won = true 
                    LIMIT 1;

                    IF v_won_stage_id IS NOT NULL THEN
                        UPDATE public.deals 
                        SET stage_id = v_won_stage_id 
                        WHERE id = v_deal_id AND pipeline_id = v_pipeline_id;
                    END IF;
                END IF;

                -- 4. REGISTRO DE AUDITORIA COMERCIAL (Promotion Link)
                -- Vincula explicitamente o ganho do deal ao aceite desta proposta específica
                INSERT INTO public.project_events (
                    deal_id,
                    event_type,
                    from_value,
                    to_value,
                    metadata
                ) VALUES (
                    v_deal_id,
                    'deal_won_by_proposal',
                    v_current_status,
                    'won',
                    jsonb_build_object(
                        'proposal_id', NEW.id,
                        'aceita_at', NEW.aceita_at,
                        'reason', 'Promoção automática via aceite formal de proposta principal'
                    )
                );
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;