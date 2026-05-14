-- BUG 2: Prevenir loop de status na aceitação de proposta
CREATE OR REPLACE FUNCTION public.sync_deal_status_on_proposal_acceptance()
RETURNS TRIGGER AS $$
DECLARE
    v_deal_id uuid;
    v_pipeline_id uuid;
    v_won_stage_id uuid;
    v_current_status text;
BEGIN
    -- Só age se o status mudar para um estado de aceite e for REALMENTE uma mudança
    IF (LOWER(NEW.status) IN ('aceita', 'aceito', 'aprovada', 'ganha')) AND 
       (OLD.status IS DISTINCT FROM NEW.status) THEN
        
        v_deal_id := COALESCE(NEW.deal_id, NEW.projeto_id);

        IF v_deal_id IS NOT NULL THEN
            -- Verifica status atual para evitar redundância
            SELECT status INTO v_current_status FROM public.deals WHERE id = v_deal_id;
            
            IF v_current_status IS DISTINCT FROM 'won' THEN
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
                        -- Move o deal no funil comercial principal (trigger sync_deal_primary cuidará do resto)
                        UPDATE public.deals 
                        SET stage_id = v_won_stage_id 
                        WHERE id = v_deal_id AND pipeline_id = v_pipeline_id;
                    END IF;
                END IF;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- BUG 1: Melhorar descrição de documentos de campos customizados
CREATE OR REPLACE FUNCTION public.fn_log_project_document_event()
RETURNS TRIGGER AS $$
DECLARE
    v_label TEXT;
    v_count INT;
BEGIN
    v_label := NEW.categoria;
    
    -- Se vier de campo customizado, tenta resolver um nome amigável
    IF NEW.categoria = 'custom-fields' THEN
        SELECT label INTO v_label 
        FROM public.etapa_documentos_obrigatorios 
        WHERE categoria = (NEW.metadata->>'field_key')
        LIMIT 1;
        
        IF v_label IS NULL THEN
            v_label := COALESCE(NEW.metadata->>'field_key', 'Documento');
        END IF;
    END IF;

    INSERT INTO public.project_events (
        tenant_id, deal_id, event_type, 
        from_value, to_value, metadata
    ) VALUES (
        NEW.tenant_id, NEW.deal_id, 'document_uploaded',
        NULL, v_label, 
        jsonb_build_object('file_name', NEW.file_name, 'bucket', NEW.bucket)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- BUG 3: Evitar registro de etapas falsas ou redundantes no histórico
CREATE OR REPLACE FUNCTION public.fn_track_deal_stage_history()
RETURNS TRIGGER AS $$
BEGIN
    -- Idempotência: não registrar se a etapa não mudou de fato
    IF OLD.stage_id IS NOT DISTINCT FROM NEW.stage_id THEN
        RETURN NEW;
    END IF;

    -- Bloqueio de etapas fantasmas (como mensagens de erro/falta docs persistidas por engano)
    -- Se o nome da etapa contiver "falta" ou "bloqueio", não registramos como transição histórica
    IF EXISTS (
        SELECT 1 FROM public.pipeline_stages 
        WHERE id IN (NEW.stage_id, OLD.stage_id) 
        AND (LOWER(name) ILIKE '%falta documento%' OR LOWER(name) ILIKE '%bloqueado%')
    ) THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.deal_stage_history (
        tenant_id, deal_id, from_stage_id, to_stage_id, moved_by
    ) VALUES (
        NEW.tenant_id, NEW.id, OLD.stage_id, NEW.stage_id, auth.uid()
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;