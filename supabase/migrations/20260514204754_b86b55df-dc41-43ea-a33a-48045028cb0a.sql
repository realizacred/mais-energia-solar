-- Função para automatizar a transição de etapa por documento
CREATE OR REPLACE FUNCTION public.handle_document_stage_automation()
RETURNS TRIGGER AS $$
DECLARE
    v_cat TEXT;
    v_membership RECORD;
    v_next_stage_id UUID;
    v_next_stage_name TEXT;
    v_current_stage_name TEXT;
BEGIN
    v_cat := LOWER(NEW.categoria);

    -- Verifica se o documento é técnico (Parecer, Homologação ou ART)
    IF v_cat LIKE '%parecer%' OR v_cat LIKE '%homolog%' OR v_cat LIKE '%art%' THEN
        
        -- Busca memberships técnicos (Engenharia ou Instalação)
        FOR v_membership IN 
            SELECT 
                dps.id,
                dps.stage_id,
                dps.pipeline_id,
                p.name as pipeline_name
            FROM public.deal_pipeline_stages dps
            JOIN public.pipelines p ON p.id = dps.pipeline_id
            WHERE dps.deal_id = NEW.deal_id
            AND (LOWER(p.name) LIKE '%engenharia%' OR LOWER(p.name) LIKE '%instalação%' OR LOWER(p.name) LIKE '%execução%')
        LOOP
            -- Busca a próxima etapa
            SELECT id, name INTO v_next_stage_id, v_next_stage_name
            FROM public.pipeline_stages
            WHERE pipeline_id = v_membership.pipeline_id
            AND position > (SELECT position FROM public.pipeline_stages WHERE id = v_membership.stage_id)
            ORDER BY position ASC
            LIMIT 1;

            -- Se encontrou uma próxima etapa, realiza a transição
            IF v_next_stage_id IS NOT NULL THEN
                
                -- Salva nome da etapa atual para o log
                SELECT name INTO v_current_stage_name FROM public.pipeline_stages WHERE id = v_membership.stage_id;

                -- Atualiza a etapa
                UPDATE public.deal_pipeline_stages 
                SET stage_id = v_next_stage_id 
                WHERE id = v_membership.id;

                -- Registra no histórico de eventos do projeto
                INSERT INTO public.project_events (
                    tenant_id,
                    deal_id,
                    event_type,
                    from_value,
                    to_value,
                    actor_user_id,
                    metadata
                ) VALUES (
                    NEW.tenant_id,
                    NEW.deal_id,
                    'stage_changed',
                    COALESCE(v_current_stage_name, 'Anterior'),
                    v_next_stage_name,
                    NEW.uploaded_by,
                    jsonb_build_object(
                        'reason', 'Automação via anexo de ' || NEW.categoria,
                        'membership_id', v_membership.id,
                        'pipeline_name', v_membership.pipeline_name,
                        'document_category', NEW.categoria,
                        'automation', true
                    )
                );
            END IF;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para disparar a automação após inserção de documento
DROP TRIGGER IF EXISTS tr_document_stage_automation ON public.project_documents;
CREATE TRIGGER tr_document_stage_automation
AFTER INSERT ON public.project_documents
FOR EACH ROW
EXECUTE FUNCTION public.handle_document_stage_automation();
