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
    v_actor_id uuid;
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
        SELECT EXISTS (
            SELECT 1 FROM public.proposal_events 
            WHERE proposta_id = NEW.id 
              AND (tipo = 'proposta_aceita' OR (tipo = 'status_change' AND payload->>'new_status' IN ('aceita', 'accepted')))
        ) INTO v_has_formal_event;

        IF NOT v_has_formal_event THEN
            RETURN NEW;
        END IF;

        v_deal_id := COALESCE(NEW.deal_id, NEW.projeto_id);

        IF v_deal_id IS NOT NULL THEN
            SELECT status INTO v_current_status FROM public.deals WHERE id = v_deal_id;
            
            IF v_current_status IS DISTINCT FROM 'won' THEN
                -- Tenta capturar o ID do usuário (auth.uid() ou o responsável pelo evento)
                v_actor_id := auth.uid();
                
                UPDATE public.deals 
                SET status = 'won', 
                    won_at = now(),
                    won_by = COALESCE(v_actor_id, NEW.consultor_id), -- Fallback para consultor se for job de sistema
                    updated_at = now() 
                WHERE id = v_deal_id;

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
                INSERT INTO public.project_events (
                    deal_id,
                    event_type,
                    from_value,
                    to_value,
                    actor_user_id,
                    metadata
                ) VALUES (
                    v_deal_id,
                    'deal_won_by_proposal',
                    v_current_status,
                    'won',
                    v_actor_id,
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
